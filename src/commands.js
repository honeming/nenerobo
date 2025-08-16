/**
 * Share command metadata from a common spot to be used for both runtime
 * and registration.
 */
// https://discord.com/developers/docs/interactions/application-commands#create-global-application-command

export const COMMANDS = {
  timecode:{
    name: 'timecode',
    description: '將時間轉換為Discord支持的時間碼格式，或將秒數轉換為時間碼。',
    options: [
      {type:3, name:'time', description:'要轉換的時間或秒數。', required:true},
    ],
  },
  generateText: {
    name: 'generate-text',
    description: '生成一段文本，使用指定的提示詞。',
    options: [
      {type:3, name:'prompt', description:'要使用的提示詞。', required:true},
      {type:3, name:'service', description:'要使用的服務', required:false,
        choices:[
          {name:'Cloudflare(Default)', value:'cloudflare'},
          // {name:'Google', value:'google'},// Coming soon
          // {name:'GitHub', value:'github'},// Coming soon
        ]
      },
      {type:3, name:'model', description:'要使用的模型。', required:false},
    ],
  },
}