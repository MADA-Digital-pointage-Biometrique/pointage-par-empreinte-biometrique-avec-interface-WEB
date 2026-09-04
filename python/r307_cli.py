#!/usr/bin/env python3
"""
CLI R307 appelé par PHP (SdkReader -> exec)
PHP passe toujours par api/biometric.php -> SdkReader -> exec python r307_cli.py

Usage:
  python r307_cli.py --port COM3 --baud 57600 --action enroll --id 12
  python r307_cli.py --port COM3 --action search
  python r307_cli.py --port COM3 --action delete --id 12
  python r307_cli.py --port COM3 --action empty
  python r307_cli.py --port COM3 --action status
  python r307_cli.py --port COM3 --action count
  python r307_cli.py --list-ports
  python r307_cli.py --auto-port
  python r307_cli.py --mock --action enroll --id 5

Sortie JSON sur stdout pour PHP :
  {"ok":true, "page_id":12, "score":87}
  {"ok":false, "message":"..."}
"""
import argparse
import json
import os
import sys

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--port', default='COM3')
    p.add_argument('--baud', type=int, default=57600)
    p.add_argument('--timeout', type=int, default=15)
    p.add_argument('--password', default='00000000')
    p.add_argument('--action', choices=['enroll','search','verify','delete','empty','status','count'], default='status')
    p.add_argument('--id', type=int, default=0, dest='page_id')
    p.add_argument('--list-ports', action='store_true')
    p.add_argument('--auto-port', action='store_true')
    p.add_argument('--mock', action='store_true', help='Simule sans matériel (pour dev sans R307)')
    args = p.parse_args()

    if args.mock:
        if args.action == 'enroll':
            print(json.dumps({"ok": True, "page_id": args.page_id, "mock": True, "message": f"Enrôlement simulé page {args.page_id}"}))
        elif args.action in ('search','verify'):
            print(json.dumps({"ok": False, "message": "Aucune empreinte (mock)", "mock": True}))
        elif args.action == 'delete':
            print(json.dumps({"ok": True, "mock": True}))
        elif args.action == 'status':
            print(json.dumps({"ok": True, "mock": True, "count": 0}))
        else:
            print(json.dumps({"ok": True, "mock": True}))
        return

    try:
        from r307_driver import R307
    except ImportError as e:
        print(json.dumps({"ok": False, "message": f"pyserial manquant: {e}. Installez: pip install pyserial"}))
        sys.exit(0)

    if args.list_ports:
        print(json.dumps({"ok": True, "ports": R307.list_ports()}))
        return
    if args.auto_port:
        print(json.dumps({"ok": True, "port": R307.auto_detect()}))
        return

    port = args.port
    if port == 'auto':
        port = R307.auto_detect() or 'COM3'

    # Vérifie Mode Opératoire du Terminal (python/mode.json) : enrolement sans cible = idle
    try:
        mode_path = os.path.join(os.path.dirname(__file__), 'mode.json')
        if os.path.exists(mode_path):
            with open(mode_path, 'r', encoding='utf-8') as mf:
                mj = json.load(mf)
            mmode = (mj.get('mode') or 'pointage')
            mtarget = mj.get('target_id')
            if args.action == 'enroll' and (mmode != 'enrolement' or not mtarget):
                print(json.dumps({"ok": False, "message": "R307 en attente : mode Pointage ou enrolement sans employé (sélectionne cible)", "mode": mmode}))
                sys.exit(0)
            if args.action == 'enroll' and int(mtarget) != int(args.page_id):
                # aligne le slot sur la cible du terminal
                args.page_id = int(mtarget)
    except Exception:
        pass

    # timeout/password depuis config (SdkReader)
    pwd = args.password
    try:
        if pwd.lower().startswith('0x'): pwd = int(pwd, 16)
        else: pwd = int(pwd, 16) if len(pwd)==8 and all(c in '0123456789abcdefABCDEF' for c in pwd) else int(pwd)
    except: pwd = 0x00000000
    r = R307(port=port, baud=args.baud, timeout=args.timeout, pwd=pwd)
    try:
        r.open()
        if args.action == 'enroll':
            # page_id = id_employe (1..1000). R307 page 0..999 — refuse au lieu de borner silencieusement
            if args.page_id < 1 or args.page_id > 999:
                print(json.dumps({"ok": False, "message": f"slot invalide {args.page_id} (1..999) — capacité R307 atteinte"}))
                sys.exit(0)
            pid = int(args.page_id)
            r.enroll(pid)
            print(json.dumps({"ok": True, "page_id": pid, "message": f"Enrôlé page {pid} sur {port}"}))
        elif args.action in ('search','verify'):
            res = r.verify_once()
            if res:
                page_id, score = res
                print(json.dumps({"ok": True, "page_id": page_id, "score": score}))
            else:
                print(json.dumps({"ok": False, "message": "Aucune correspondance"}))
        elif args.action == 'delete':
            r.delete(args.page_id)
            print(json.dumps({"ok": True, "message": f"Supprimé page {args.page_id}"}))
        elif args.action == 'empty':
            r.empty()
            print(json.dumps({"ok": True, "message": "Base R307 vidée"}))
        elif args.action in ('status','count'):
            cnt = r.template_num()
            print(json.dumps({"ok": True, "count": cnt, "port": port}))
        else:
            print(json.dumps({"ok": False, "message": "Action inconnue"}))
    except Exception as e:
        print(json.dumps({"ok": False, "message": str(e), "port": port}))
        sys.exit(0)
    finally:
        try: r.close()
        except: pass

if __name__ == '__main__':
    main()