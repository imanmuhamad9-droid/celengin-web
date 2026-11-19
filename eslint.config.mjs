import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Aturan "React Compiler" ini menandai pola yang umum dan disengaja di kode ini: ambil data saat halaman dibuka,
    // atur ulang form saat modal dibuka, isi tanggal/localStorage setelah mount (hindari mismatch hydration).
    // Dijadikan peringatan supaya tetap terlihat, tetapi tidak menutupi error lint yang sungguhan.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/globals": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/use-memo": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
