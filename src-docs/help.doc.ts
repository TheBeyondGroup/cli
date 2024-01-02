import {ReferenceEntityTemplateSchema} from '@shopify/generate-docs'

const data: ReferenceEntityTemplateSchema = {
  name: 'help',
  description: `Display help for <%= config.bin %>.`,
  overviewPreviewDescription: `Display help for <%= config.bin %>.`,
  type: 'command',
  isVisualComponent: false,
  defaultExample: {
    codeblock: {
      tabs: [
        {
          title: 'help',
          code: './examples/help.example.sh',
          language: 'bash',
        },
      ],
      title: 'help',
    },
  },
  definitions: [
    {
      title: 'help',
      description: 'The following flags are available for the `help` command:',
      type: 'help',
    },
  ],
  category: 'Commands',
  subCategory: 'common',
  related: [
  ],
}

export default data