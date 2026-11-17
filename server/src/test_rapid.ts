import axios from "axios";
import dotenv from "dotenv";
import logger from "./utils/logger";
dotenv.config();

const options = {
	method: "GET",
	url: "https://twitter-api45.p.rapidapi.com/timeline.php",
	params: { screenname: "ALLENkota" },
	headers: {
		"X-RapidAPI-Key": process.env.RAPIDAPI_KEY || "",
		"X-RapidAPI-Host": "twitter-api45.p.rapidapi.com",
	},
};

axios
	.request(options)
	.then(function (response) {
		logger.info(response.data);
	})
	.catch(function (error) {
		logger.error(error.response ? error.response.data : error.message);
	});
