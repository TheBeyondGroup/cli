import {ReferenceEntityTemplateSchema} from '@shopify/generate-docs'

const data: ReferenceEntityTemplateSchema = {
  name: 'app dev',
  description: `[Builds the app](/docs/apps/tools/cli/commands#build) and lets you preview it on a [development store](/docs/apps/tools/development-stores) or [Plus sandbox store](https://help.shopify.com/partners/dashboard/managing-stores/plus-sandbox-store?shpxid=f75d4b9f-3CE2-4156-F28E-0364F1AF6ABB).

  To preview your app on a development store or Plus sandbox store, Shopify CLI walks you through the following steps. If you've run \`dev\` before, then your settings are saved and some of these steps are skipped. You can reset these configurations using \`dev --reset\` to go through all of them again:

- Associating your project with an app associated with your Partner account or organization, or creating a new app.
- Selecting a development store or Plus sandbox store to use for testing. If you have only one store, then it's selected automatically.
- Installing your app on the store using the provided install link.
- Creating a tunnel between your local environment and the store using Cloudflare.

  You can use your own tunneling software instead, by passing your tunnel URL with the \`--tunnel-url\` flag.
- Updating the app URLs that are set in the Partner Dashboard.

  To avoid overwriting any URLs that are already set, select the No, never option. If you select this option, then you're provided with URLs that you can manually add in the Partner Dashboard so you can preview your app.

- Enabling development store preview for extensions.
- Building and serving your app and app extensions.

If you're using the PHP or Ruby app template, then you need to complete the following steps before you can preview your app for the first time:

- PHP: [Set up your Laravel app](https://github.com/Shopify/shopify-app-template-php#setting-up-your-laravel-app)
- Ruby: [Set up your Rails app](https://github.com/Shopify/shopify-app-template-ruby#setting-up-your-rails-app)

> Caution: To use a development store or Plus sandbox store with Shopify CLI, you need to be the store owner, or have a staff account on the store. Staff accounts are created automatically the first time you access a development store with your Partner staff account through the Partner Dashboard.
  `,
  overviewPreviewDescription: `Run the app.`,
  type: 'command',
  isVisualComponent: false,
  defaultExample: {
    codeblock: {
      tabs: [
        {
          title: 'app dev',
          code: './examples/app-dev.example.sh',
          language: 'bash',
        },
      ],
      title: 'app dev',
    },
  },
  definitions: [
    {
      title: 'app dev',
      description: 'The following flags are available for the `app dev` command:',
      type: 'appdev',
    },
  ],
  category: 'Commands',
  subCategory: 'app',
  related: [
  ],
}

export default data