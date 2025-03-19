# Svelte + Vite

This template should help get you started developing with Svelte in Vite.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Svelte](https://marketplace.visualstudio.com/items?itemName=svelte.svelte-vscode).

## Need an official Svelte framework?

Check out [SvelteKit](https://github.com/sveltejs/kit#readme), which is also powered by Vite. Deploy anywhere with its serverless-first approach and adapt to various platforms, with out of the box support for TypeScript, SCSS, and Less, and easily-added support for mdsvex, GraphQL, PostCSS, Tailwind CSS, and more.

## Technical considerations

**Why use this over SvelteKit?**

- It brings its own routing solution which might not be preferable for some users.
- It is first and foremost a framework that just happens to use Vite under the hood, not a Vite app.

This template contains as little as possible to get started with Vite + Svelte, while taking into account the developer experience with regards to HMR and intellisense. It demonstrates capabilities on par with the other `create-vite` templates and is a good starting point for beginners dipping their toes into a Vite + Svelte project.

Should you later need the extended capabilities and extensibility provided by SvelteKit, the template has been structured similarly to SvelteKit so that it is easy to migrate.

**Why `global.d.ts` instead of `compilerOptions.types` inside `jsconfig.json` or `tsconfig.json`?**

Setting `compilerOptions.types` shuts out all other types not explicitly listed in the configuration. Using triple-slash references keeps the default TypeScript setting of accepting type information from the entire workspace, while also adding `svelte` and `vite/client` type information.

**Why include `.vscode/extensions.json`?**

Other templates indirectly recommend extensions via the README, but this file allows VS Code to prompt the user to install the recommended extension upon opening the project.

**Why enable `checkJs` in the JS template?**

It is likely that most cases of changing variable types in runtime are likely to be accidental, rather than deliberate. This provides advanced typechecking out of the box. Should you like to take advantage of the dynamically-typed nature of JavaScript, it is trivial to change the configuration.

**Why is HMR not preserving my local component state?**

HMR state preservation comes with a number of gotchas! It has been disabled by default in both `svelte-hmr` and `@sveltejs/vite-plugin-svelte` due to its often surprising behavior. You can read the details [here](https://github.com/sveltejs/svelte-hmr/tree/master/packages/svelte-hmr#preservation-of-local-state).

If you have state that's important to retain within a component, consider creating an external store which would not be replaced by HMR.

```js
// store.js
// An extremely simple external store
import { writable } from 'svelte/store'
export default writable(0)
```

run android
Buld:
npm run build && rm -rf www && cp -r dist/ www/ && npx cap sync android && npx cap run android

Live reload Host:
npm run dev -- --host

npx cap run android


git add . && git commit -m ""

npm run build && rm -rf ios/App/App/public && mkdir -p ios/App/App/public && cp -r dist/* ios/App/App/public/



Make Admin:
node scripts/setAdmin.js Yg3hyxb9OWMq9mVuMYsgThaV2r83





Primary Colors:
Teal/Blue-green: #216974 (Main brand color, used extensively)
Darker variant: #185761
Used for buttons, links, and primary UI elements
Orange/Brown: #E09453
Darker variant: #c77f43
Used for alternative buttons/actions
Neutral Colors:
1. White: #FFFFFF (or white)
Light Gray: #F8FAFC (background)
Gray variations:
#666666 (text)
#999999 (lighter text)
#333333 (dark text)
#444444 (dark text)
#888888 (medium gray)
#E0E0E0 (very light gray, borders)
Utility Colors:
Error Red: #ef4444, #dc3545
Google Blue: #4285f4
Darker variant: #357ae8


