import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  { ignores: [".security-audit/**", "playwright-report/**", "test-results/**", "output/playwright/**", ".ci-java-tmp/**"] },
  ...nextVitals,
  ...nextTypescript
];

export default eslintConfig;
