const fetchApi = require('node-fetch')
const CoinformClient = require('../src/js/coinform-client')

describe('The Coinform client should...', () => {

  describe('be able to communicate with the API', () => {
  
    const client = new CoinformClient(fetchApi, 'https://api.coinform.eu')
    var query_id;
    // Check if response is finished with the status response as a "done"
    it(' to obtain a response for the tweet with author Bill Gates using endpoint /twitter/tweet/', (done) => {
      client.postCheckTweetInfo('1234567890', '@BillGates', 'Hi! My name is Bill Gates')
        .then(res => {
          query_id = JSON.stringify(res.query_id);
          expect(res).toEqual(jasmine.objectContaining({ status: 'done' }))  
          done();
        })
        .catch(err => console.log(err))
    })

    it(' to obtain a response for the tweet with author Bill Gates using endpoint /response/{query_id}', (done) => {
      client.getResponseTweetInfo(query_id)
        .then(res => {
          expect(res).toEqual(jasmine.objectContaining({ status: 'done' }))
          done();
        })
    })

    it(' to obtain a correct evaluation Id for a tweet', (done) => {
      var evaluation = { "evaluation": [ { "label": "acurate", "url": "https://example.com", "comment": "Simple comment"}] }
      var tweetID = '1234567890';

      client.postTwitterEvaluate(tweetID, evaluation)
        .then(res => { 
          expect(JSON.stringify(res.evaluation_id)).toEqual(jasmine.any(String));
          done();
        })
    })
    

  })
})