import {ReferenceEntityTemplateSchema} from '@shopify/generate-docs'

const data: ReferenceEntityTemplateSchema = {
  name: 'app versions list',
  description: `List deployed versions of your app.`,
  overviewPreviewDescription: `List deployed versions of your app.`,
  type: 'command',
  isVisualComponent: false,
  defaultExample: {
    codeblock: {
      tabs: [
        {
          title: 'app versions list',
          code: './examples/app-versions-list.example.sh',
          language: 'bash',
        },
      ],
      title: 'app versions list',
    },
  },
  definitions: [
    {
      title: 'app versions list',
      description: 'The following flags are available for the `app versions list` command:',
      type: 'appversionslist',
    },
  ],
  category: 'Commands',
  subCategory: 'app',
  related: [
  ],
}

export default data