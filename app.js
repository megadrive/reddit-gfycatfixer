'use strict'

const config = require('./config')
const Snoowrap = require('snoowrap')
const jsonfile = require('jsonfile')

const r = new Snoowrap({
  userAgent: config.userAgent,
  clientId: config.client.id,
  clientSecret: config.client.secret,
  refreshToken: config.tokens.refresh
})

let reGfycatDetail = /https?:\/\/(www.)?gfycat\.com(\/gifs\/detail)\/[A-Za-z]+/ig

/**
 * @param {object} opts options object
 * @return {Promise}
 */
function searchAndDetectGfys (opts) {
  return new Promise(function (resolve, reject) {
    r.getSubreddit(config.subreddit).getNew()
      .then(submissions => {
        let fixed = jsonfile.readFileSync('./fixed.json', {throws: false})
        fixed = fixed || {data: []}
        let foundSubmissions = []

        submissions.forEach(s => {
          if (fixed.data.includes(s.id) === false) {
            if (s.url.match(reGfycatDetail)) foundSubmissions.push(s)
          }
        })

        appendToJson(submissions)
          .catch(console.info)

        console.info(`Found ${foundSubmissions.length} bad gfy links.`)
        resolve(foundSubmissions)
      })
  })
}

function removeDetail (submissions) {
  return new Promise(function (resolve, reject) {
    submissions.forEach(s => {
      s.url = s.url.replace('gifs/detail/', '')
    })

    resolve(submissions)
  })
}

function outputToConsole (submissions) {
  submissions.forEach(s => {
    const subreddit = s.subreddit_name_prefixed
    const title = s.title
    const url = s.url

    console.info(`gfy link fixed in ${subreddit} -- "${title}" -- ${url}`)
  })
}

function appendToJson (submissions) {
  return new Promise(function (resolve, reject) {
    let fixed = jsonfile.readFileSync('./fixed.json', {throws: false})
    fixed = fixed || {data: []}

    submissions.forEach(el => {
      fixed.data.push(el.id)
    })

    jsonfile.writeFile('./fixed.json', fixed, {}, err => {
      if (err) {
        reject(Error(err))
      } else {
        resolve(submissions)
      }
    })
  })
}

function addComment (submissions) {
  return new Promise(function (resolve, reject) {
    submissions.forEach(s => {
      let template = smallen(config.template)
      template = template.replace('[[fixed_url]]', s.url)
      s.reply(template)
    })

    resolve(submissions)
  })
}

/**
 * @return {string}
 */
function smallen (text) {
  const resmallen = /\[\[smallen\|(.+?)\]\]/g
  let smallen = resmallen.exec(text)[1]

  let split = smallen.split(' ')
  let smalled = split.map(el => {
    return '^^' + el
  })
  return text.replace(resmallen, smalled.join(' '))
}

setInterval(function () {
  console.info(`Searching for new gfycat posts to fix in ${config.subreddit} ..`)
  searchAndDetectGfys()
    .then(removeDetail)
    .then(addComment)
    .then(outputToConsole)
    .catch(err => {
      console.info(err.message)
    })
}, 30000 /* 30s */)
