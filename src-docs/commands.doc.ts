import {ReferenceEntityTemplateSchema} from '@shopify/generate-docs'

const data: ReferenceEntityTemplateSchema = {
  name: 'commands',
  description: `list all the commands`,
  overviewPreviewDescription: `list all the commands`,
  type: 'command',
  isVisualComponent: false,
  defaultExample: {
    codeblock: {
      tabs: [
        {
          title: 'commands',
          code: './examples/commands.example.sh',
          language: 'bash',
        },
      ],
      title: 'commands',
    },
  },
  definitions: [
    {
      title: 'commands',
      description: 'The following flags are available for the `commands` command:',
      type: 'commands',
    },
  ],
  category: 'Commands',
  subCategory: 'common',
  related: [
  ],
}

export default data