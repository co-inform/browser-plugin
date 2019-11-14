const cheerio = require('cheerio')
const fs = require('fs')
const TweetParser = require('../src/js/tweet-parser')

describe('The tweet parser should...', () => {

  const parser = new TweetParser()

  describe('be able to', () => {

    it('detect at least 28 fully loaded tweets from test.html', done => {
      const $ = loadFile('./spec/support/test.html')
      let tweetCount = 0
      
      parser.fromExternalFile($, () => {
        tweetCount++
        if (tweetCount => 28) done()
     })
      expect(tweetCount).toBeGreaterThanOrEqual(28)
    })
  })
})

function loadFile(path) {
  const buffer = fs.readFileSync(path, 'utf-8')
  const $ = cheerio.load(buffer)
  return $
}
