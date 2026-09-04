#!/usr/bin/env python3
"""
Service local R307 — évite concurrence poll 5s sur le même COM
PHP -> HTTP localhost:8765 -> R307 (lock unique)
Usage: py r307_service.py --port auto --baud 57600
"""
import argparse, json, threading, time
from http.server import BaseHTTPRequestHandler, HTTPServer
try:
    from r307_driver import R307
except ImportError:
    R307=None

lock = threading.Lock()
r307_instance = None
args_global = None

class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get('Content-Length',0))
        body = self.rfile.read(length) if length else b'{}'
        try: data=json.loads(body)
        except: data={}
        action = self.path.strip('/').split('?')[0]  # enroll/search/delete/status/count
        if action not in ('enroll','search','delete','status','count','empty'):
            action = data.get('action', 'status')
        page_id = int(data.get('id') or data.get('page_id') or 0)
        with lock:
            try:
                if R307 is None: raise RuntimeError('pyserial manquant')
                r = r307_instance
                # réutilise instance ou recrée
                if action=='enroll':
                    if page_id<1 or page_id>999: raise RuntimeError(f'slot invalide {page_id}')
                    r.enroll(page_id, timeout=args_global.timeout)
                    self.send_json({"ok":True,"page_id":page_id})
                elif action in ('search','verify'):
                    res=r.verify_once(timeout=args_global.timeout)
                    if res: self.send_json({"ok":True,"page_id":res[0],"score":res[1]})
                    else: self.send_json({"ok":False,"message":"Aucune correspondance"})
                elif action=='delete':
                    r.delete(page_id)
                    self.send_json({"ok":True})
                elif action in ('status','count'):
                    cnt=r.template_num()
                    self.send_json({"ok":True,"count":cnt,"port":r.port})
                elif action=='empty':
                    r.empty()
                    self.send_json({"ok":True})
                else:
                    self.send_json({"ok":False,"message":"action inconnue"})
            except Exception as e:
                self.send_json({"ok":False,"message":str(e)}, code=500)
    def do_GET(self):
        # status via GET aussi
        self.path='/status'
        self.do_POST()
    def send_json(self, obj, code=200):
        b=json.dumps(obj).encode()
        self.send_response(code)
        self.send_header('Content-Type','application/json')
        self.send_header('Content-Length', str(len(b)))
        self.end_headers()
        self.wfile.write(b)
    def log_message(self, fmt, *a): pass

def main():
    global r307_instance, args_global
    p=argparse.ArgumentParser()
    p.add_argument('--port', default='auto')
    p.add_argument('--baud', type=int, default=57600)
    p.add_argument('--timeout', type=int, default=15)
    p.add_argument('--password', default='00000000')
    p.add_argument('--host', default='127.0.0.1')
    p.add_argument('--http-port', type=int, default=8765)
    args=p.parse_args()
    args_global=args
    port=args.port
    if port=='auto' and R307:
        port=R307.auto_detect() or 'COM3'
    pwd=args.password
    try:
        if pwd.lower().startswith('0x'): pwd=int(pwd,16)
        else: pwd=int(pwd,16) if len(pwd)==8 and all(c in '0123456789abcdefABCDEF' for c in pwd) else int(pwd)
    except: pwd=0
    r307_instance=R307(port=port, baud=args.baud, timeout=args.timeout, pwd=pwd)
    try: r307_instance.open()
    except Exception as e: print(f"R307 open échoué {port}: {e}")
    srv=HTTPServer((args.host, args.http_port), Handler)
    print(f"R307 service http://{args.host}:{args.http_port} port={port} baud={args.baud}")
    srv.serve_forever()

if __name__=='__main__': main()
