import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const options = {
  method: 'GET',
  url: 'https://twitter-api45.p.rapidapi.com/timeline.php',
  params: { screenname: 'ALLENkota' },
  headers: {
    'X-RapidAPI-Key': 'beda4cc154mshcc41f33855d8bb6p124685jsn7c757cfc4339',
    'X-RapidAPI-Host': 'twitter-api45.p.rapidapi.com'
  }
};

axios.request(options).then(function (response) {
	console.log(response.data);
}).catch(function (error) {
	console.error(error.response ? error.response.data : error.message);
});
