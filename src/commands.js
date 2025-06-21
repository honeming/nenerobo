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
  }
}