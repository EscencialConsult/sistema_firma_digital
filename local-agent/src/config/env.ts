function env(key: string, fallback?: string): string | undefined {
  return process.env[key] ?? fallback;
}

export const config = {
  pkcs11ModulePath: env("PKCS11_MODULE_PATH"),
  pkcs11ToolPath: env("PKCS11_TOOL_PATH"),
  pkcs11CertId: env("PKCS11_CERT_ID"),
  pyhankoPythonPath: env("PYHANKO_PYTHON_PATH"),
};
