import rootConfig from "../../../eslint.config.mjs";
import tseslint from "typescript-eslint";

export default [
    ...rootConfig,
    ...tseslint.configs.recommended,
    {
        files: ["**/*.ts"],
        languageOptions: {
            parserOptions: {
                project: ["tsconfig.lib.json", "tsconfig.spec.json"],
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            "@typescript-eslint/interface-name-prefix": "off",
            "@typescript-eslint/explicit-function-return-type": "off",
            "@typescript-eslint/explicit-module-boundary-types": "off",
            "@typescript-eslint/no-explicit-any": "off",
        },
    },
    {
        ignores: ["eslint.config.mjs", "jest.config.js"],
    },
];
