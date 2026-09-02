"""
Driver R307 + CP2102 (USB-UART) - Protocole 0xEF01
Appelé uniquement via PHP (api/biometric.php -> SdkReader -> exec python)
R307 : 57600 bauds, adresse 0xFFFFFFFF, pwd 0x00000000
"""
import struct
import time
import serial
import serial.tools.list_ports

HEADER = b'\xEF\x01'
PID_CMD = 0x01
PID_DATA = 0x02
PID_ACK = 0x07

# Instructions R307
CMD_GEN_IMG = 0x01
CMD_IMG2TZ = 0x02
CMD_MATCH = 0x03
CMD_SEARCH = 0x04
CMD_REG_MODEL = 0x05
CMD_STORE = 0x06
CMD_LOAD = 0x07
CMD_UP_CHAR = 0x08
CMD_DOWN_CHAR = 0x09
CMD_UP_IMAGE = 0x0A
CMD_DELETE = 0x0C
CMD_EMPTY = 0x0D
CMD_VERIFY_PWD = 0x13
CMD_SET_ADDR = 0x15
CMD_TEMPLATE_NUM = 0x1D

CONFIRM_OK = 0x00
ERR_NOFINGER = 0x02

class R307:
    def __init__(self, port='COM3', baud=57600, addr=0xFFFFFFFF, pwd=0x00000000, timeout=1):
        self.port = port
        self.baud = baud
        self.addr = addr
        self.pwd = pwd
        self.timeout = timeout
        self.ser = None

    @staticmethod
    def list_ports():
        return [p.device for p in serial.tools.list_ports.comports()]

    @staticmethod
    def auto_detect():
        for p in serial.tools.list_ports.comports():
            # CP2102 VID:PID 10C4:EA60
            if 'CP210' in (p.description or '') or (p.vid == 0x10C4 and p.pid == 0xEA60):
                return p.device
        ports = R307.list_ports()
        return ports[0] if ports else None

    def open(self):
        self.ser = serial.Serial(self.port, self.baud, timeout=self.timeout)
        time.sleep(0.2)
        self.verify_pwd()

    def close(self):
        if self.ser and self.ser.is_open:
            self.ser.close()

    def _packet(self, pid, payload: bytes):
        addr = struct.pack('>I', self.addr)
        length = len(payload) + 2  # + checksum
        chk = pid + (length >> 8) + (length & 0xFF) + sum(payload)
        return HEADER + addr + struct.pack('B', pid) + struct.pack('>H', length) + payload + struct.pack('>H', chk & 0xFFFF)

    def _read_ack(self, timeout=3):
        self.ser.timeout = timeout
        # 12 bytes header + data
        hdr = self.ser.read(9)
        if len(hdr) < 9 or hdr[0:2] != HEADER:
            raise RuntimeError('Réponse R307 invalide (header)')
        pid = hdr[6]
        length = struct.unpack('>H', hdr[7:9])[0]
        data = self.ser.read(length)
        if len(data) < length:
            raise RuntimeError('Réponse R307 incomplète')
        # data[0] = confirm code
        confirm = data[0]
        return confirm, data[1:-2]  # sans checksum, sans confirm

    def _cmd(self, ins, params=b'', timeout=3):
        pkt = self._packet(PID_CMD, struct.pack('B', ins) + params)
        self.ser.reset_input_buffer()
        self.ser.write(pkt)
        confirm, resp = self._read_ack(timeout)
        return confirm, resp

    def verify_pwd(self):
        confirm, _ = self._cmd(CMD_VERIFY_PWD, struct.pack('>I', self.pwd))
        if confirm != CONFIRM_OK:
            raise RuntimeError(f'VerifyPwd échoué: 0x{confirm:02X}')

    def gen_img(self, timeout=5):
        # Attend doigt, boucle jusqu'à finger
        t0 = time.time()
        while time.time() - t0 < timeout:
            confirm, _ = self._cmd(CMD_GEN_IMG, timeout=1)
            if confirm == CONFIRM_OK:
                return True
            if confirm == ERR_NOFINGER:
                time.sleep(0.3)
                continue
            raise RuntimeError(f'GenImg erreur 0x{confirm:02X}')
        raise RuntimeError('Aucune empreinte détectée (timeout)')

    def img2tz(self, buf=1):
        confirm, _ = self._cmd(CMD_IMG2TZ, struct.pack('B', buf))
        if confirm != CONFIRM_OK:
            raise RuntimeError(f'Img2Tz buf={buf} erreur 0x{confirm:02X}')

    def reg_model(self):
        confirm, _ = self._cmd(CMD_REG_MODEL)
        if confirm != CONFIRM_OK:
            raise RuntimeError(f'RegModel erreur 0x{confirm:02X}')

    def store(self, buf=1, page_id=0):
        confirm, _ = self._cmd(CMD_STORE, struct.pack('B', buf) + struct.pack('>H', page_id))
        if confirm != CONFIRM_OK:
            raise RuntimeError(f'Store page {page_id} erreur 0x{confirm:02X}')

    def search(self, buf=1, start=0, count=1000):
        confirm, resp = self._cmd(CMD_SEARCH, struct.pack('B', buf) + struct.pack('>H', start) + struct.pack('>H', count))
        if confirm == CONFIRM_OK:
            # resp: pageID (2), score (2)
            page_id = struct.unpack('>H', resp[0:2])[0]
            score = struct.unpack('>H', resp[2:4])[0]
            return page_id, score
        return None

    def delete(self, page_id, count=1):
        confirm, _ = self._cmd(CMD_DELETE, struct.pack('>H', page_id) + struct.pack('>H', count))
        if confirm != CONFIRM_OK:
            raise RuntimeError(f'Delete {page_id} erreur 0x{confirm:02X}')

    def empty(self):
        confirm, _ = self._cmd(CMD_EMPTY)
        if confirm != CONFIRM_OK:
            raise RuntimeError(f'Empty erreur 0x{confirm:02X}')

    def template_num(self):
        confirm, resp = self._cmd(CMD_TEMPLATE_NUM)
        if confirm != CONFIRM_OK:
            raise RuntimeError('TemplateNum erreur')
        return struct.unpack('>H', resp[0:2])[0]

    # Haut niveau : enrôlement 2 poses -> store
    def enroll(self, page_id, tries=2):
        for i in range(tries):
            # pose i+1
            self.gen_img(timeout=8)
            self.img2tz(1 if i == 0 else 2)
            if i == 0:
                # demande seconde pose
                time.sleep(0.5)
        self.reg_model()
        self.store(1, page_id)
        return page_id

    def verify_once(self):
        self.gen_img(timeout=8)
        self.img2tz(1)
        res = self.search(1)
        return res  # (page_id, score) ou None
