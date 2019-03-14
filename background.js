// https://developers.google.com/youtube/v3/docs/videos/list
// https://developers.google.com/youtube/v3/getting-started#fields

const endpoint = "https://www.googleapis.com/youtube/v3/videos";

// Note: the API key below is NOT a secret. It was generated using these settings:
// 
// * Where will you be calling the API from?  [ Web browser (JavaScript) ]
// * What data will you be accessing?         [ Public data              ]
// * Only accept requests from:               [ https://*.youtube.com/*  ]
// 
// It cannot be used to access user data. Google just uses it for rate limiting.

const key = "AIzaSyCaHWZYPuLv4cD6k-TQjg4Jx_1GQnG1wFw"; 

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    if (request.contentScriptQuery == "queryId") {
		fetch(endpoint+'?part=snippet&fields=items(snippet(tags))&id='+encodeURIComponent(request.sendId)+'&key='+key)
          .then(r => r.json())
          .then(r => (r.items[0] && r.items[0].snippet.tags) || [])
		  .then(r => sendResponse(r));
		return true;
    }
  }
);
