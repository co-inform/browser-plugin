const fetchApi = require('node-fetch')
const CoinformClient = require('../src/js/coinform-client')

describe('The Coinform client should...', () => {

  describe('be able to communicate with the API', () => {
  
    const client = new CoinformClient(fetchApi, 'https://api.coinform.eu')
    let queryId;
    // Check if response is finished with the status response as a "done"
    it('to obtain a response for the tweet with author Bill Gates using endpoint /twitter/tweet/', (done) => {
      client.postCheckTweetInfo('1234567890', '@BillGates', 'Hi! My name is Bill Gates')
        .then(res => {
          queryId = JSON.stringify(res.query_id);
          expect(res).toEqual(jasmine.objectContaining({ status: 'done' }))  
          done();
        })
        .catch(err => console.log(err))
    })

    it(' to obtain a resposne for the tweet with author Bill Gates using endpoint /response/{query_id}', (done) => {
      client.getResponseTweetInfo(queryId)
        .then(res => {
          expect(res).toEqual(jasmine.objectContaining({ status: 'done' }))
          done();
        })
    })

    

  })
})