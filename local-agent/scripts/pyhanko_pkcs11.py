import argparse
import json
import sys
from pathlib import Path

import pkcs11
from pkcs11 import Attribute, ObjectClass
from pyhanko.pdf_utils.incremental_writer import IncrementalPdfFileWriter
from pyhanko.sign import signers
from pyhanko.sign.fields import SigFieldSpec
from pyhanko.sign.pkcs11 import PKCS11Signer, open_pkcs11_session


def serialize_id(value):
    if value is None:
        return None
    if isinstance(value, bytes):
        return value.hex()
    return str(value)


def to_int(value, default=0):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def detect(args):
    lib = pkcs11.lib(args.module_path)
    tokens = []
    for slot in lib.get_slots(token_present=True):
        token = slot.get_token()
        token_data = {
            "modulePath": args.module_path,
            "moduleName": Path(args.module_path).name,
            "slot": str(getattr(slot, "slot_id", "")),
            "label": getattr(token, "label", None),
            "manufacturer": getattr(token, "manufacturer_id", None),
            "model": getattr(token, "model", None),
            "serial": serialize_id(getattr(token, "serial", None)),
            "certificates": []
        }
        if args.pin:
            with token.open(user_pin=args.pin) as session:
                objects = session.get_objects({Attribute.CLASS: ObjectClass.CERTIFICATE})
                for cert in objects:
                    token_data["certificates"].append(
                        {
                            "id": serialize_id(cert.get(Attribute.ID)),
                            "label": cert.get(Attribute.LABEL)
                        }
                    )
        tokens.append(token_data)
    print(json.dumps({"tokens": tokens}))


def sign(args):
    slot_no = to_int(args.slot, 0)
    session = open_pkcs11_session(
        lib_location=args.module_path,
        slot_no=slot_no,
        user_pin=args.pin,
    )
    cert_id = bytes.fromhex(args.cert_id) if args.cert_id else None
    signer = PKCS11Signer(session, cert_id=cert_id)

    with open(args.input_pdf, "rb") as inf:
        writer = IncrementalPdfFileWriter(inf)
        meta = signers.PdfSignatureMetadata(
            field_name="SignaturePKCS11",
            reason="Firma Electrónica PKCS#11",
            location="Firma Electrónica Portal",
            contact_info=args.contact_info,
            name=args.signer_name,
        )
        field_spec = SigFieldSpec(
            sig_field_name="SignaturePKCS11",
            on_page=max(to_int(args.page, 1) - 1, 0),
            box=(
                to_int(args.x, 50),
                to_int(args.y, 50),
                to_int(args.x, 50) + to_int(args.width, 190),
                to_int(args.y, 50) + to_int(args.height, 64),
            ),
        )
        with open(args.output_pdf, "wb") as outf:
            signers.sign_pdf(
                writer,
                signature_meta=meta,
                signer=signer,
                new_field_spec=field_spec,
                output=outf,
            )

    print(json.dumps({"ok": True, "output": args.output_pdf}))


def main():
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)

    detect_parser = subparsers.add_parser("detect")
    detect_parser.add_argument("--module-path", required=True)
    detect_parser.add_argument("--pin")
    detect_parser.set_defaults(func=detect)

    sign_parser = subparsers.add_parser("sign")
    sign_parser.add_argument("--module-path", required=True)
    sign_parser.add_argument("--pin", required=True)
    sign_parser.add_argument("--slot")
    sign_parser.add_argument("--cert-id")
    sign_parser.add_argument("--input-pdf", required=True)
    sign_parser.add_argument("--output-pdf", required=True)
    sign_parser.add_argument("--signer-name", required=True)
    sign_parser.add_argument("--contact-info", required=True)
    sign_parser.add_argument("--page")
    sign_parser.add_argument("--x")
    sign_parser.add_argument("--y")
    sign_parser.add_argument("--width")
    sign_parser.add_argument("--height")
    sign_parser.set_defaults(func=sign)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(json.dumps({"error": str(exc)}), file=sys.stderr)
        sys.exit(1)
