// =================
// Tag loading logic
// =================

const state = {

    /**
     * @type {String|null}
     */
    lastVideoId: null
};

/**
 * Indicates whether the current page is using YouTube's newer layout. This is true for
 * most users now, but some still use browser extensions to revert to the old layout.
 * 
 * @return {Boolean}
 */
const isMaterialDesign = () => document.body.id !== "body";

/**
 * Parses the current video ID from the window's URL. Used to retrieve metadata from
 * the API, and to track which video's tags were last loaded.
 * 
 * @return {String} 
 */
const getVideoId = () => new URLSearchParams(window.location.search).get("v");

/**
 * Indicates whether the current page is a video page.
 * 
 * @return {Boolean}
 */
const isVideoPage = () => window.location.href.indexOf("/watch?v=") !== -1;

/**
 * Indicates whether the video has changed since the last time tags were loaded.
 * 
 * @return {Boolean}
 */
const hasNavigated = () => state.lastVideoId != getVideoId();

/**
 * Helper to fetch the current video's tags from the YouTube API. Rate limited to
 * approx. 300,000 calls a day. This function must be called "lazily", or that 
 * limit will be reached within hours.
 *
 * @param {String} id
 * 
 * @return {Promise.<String[]>}
 */
 var gresponse;
const fetchTags = id => {
    chrome.runtime.sendMessage({contentScriptQuery: "queryId", sendId: id}, function(response){
        addTagsToDom(response);
    });
}

/**
 * Updates `state.lastVideoId` and loads the current video's tags into the DOM, 
 * or shows an error message on failure. Make sure that `hasNavigated` and 
 * `isVideoPage` are both `true` before invoking this.
 *
 * @returns {Promise}
 */
const loadTagsForCurrentVideo = () => {

    const id = getVideoId();

    state.lastVideoId = id;

    fetchTags(id);
};

// ============
// Update loops
// ============

/**
 * Starts up tag loading for the newer YouTube layout.
 */
const startupMaterialDesign = () => {

    /**
     * Runs periodically to hook tag loading into the YouTube UI.
     */
    const tryUpdate = () => {

        if (!hasNavigated() || !isVideoPage()) {
            return;
        }

        clearTags();

        /**
         * Makes sure that the "Show more" button is set up to load the tags when 
         * needed. If the "Show more" button is hidden, tags are loaded and
         *  displayed by default.
         * 
         * @param {Element} moreButton
         */
        const tryAddLazyLoadingHook = moreButton => {
            if (moreButton.getAttribute("hidden") !== null) {
                loadTagsForCurrentVideo();
            } else {
                for (const event of ["mouseover", "click"]) {
                    loadTagsOn(event, moreButton)
                }
            }
        };

        // The "Show more" button can take some time to appear in the DOM, so
        // `pollSelector` is used to wait for its appearance.

        pollSelector("#meta paper-button#more")
            .then(tryAddLazyLoadingHook)
            .catch(loadTagsForCurrentVideo);
    };

    // Note: sometimes when first opening a YouTube page, the "yt-page-data-updated" event 
    // does not fire. Hence the backup `setTimeout` below: it won't do anything most of the
    // time, but every now and then, it's required.

    window.addEventListener("yt-page-data-updated", tryUpdate);

    setTimeout(tryUpdate, 300);
};

/**
 * Starts up tag loading for the older YouTube layout.
 */
const startupLegacy = () => setInterval(() => {

    if (!isVideoPage() || !hasNavigated()) {
        return;
    }

    pollSelector(".yt-uix-button.yt-uix-expander-collapsed-body")
        .then(b => loadTagsOn("click", b))
        .catch(loadTagsForCurrentVideo);

}, 500);

/**
 * Load tags into the DOM when a given event occurs on the target. Used to preload 
 * tags when the user hovers over the "Show more" button, to minimize the delay.
 *
 * @param {String} event "mouseover" | "click" | ...
 * @param {Element} target
 */
const loadTagsOn = (event, target) => {
    const key = `data-tfyt-preload-on-${event}`;
    if (!target.getAttribute(key)) {
        target.setAttribute(key, "bound");
        target.addEventListener(event, () => {
            if (isVideoPage() && hasNavigated()) {
                loadTagsForCurrentVideo();
            }
        });
    }
};

/**
 * Finds an element in the DOM. Will retry for a duration if the element is not
 * present yet. Rejects the promise if the timeout expires.
 *
 * @param {string} selector
 * @param {number} msTimeout
 * 
 * @return {Promise.<Element>}
 */
const pollSelector = (selector, msTimeout = 10 * 1000) => new Promise((resolve, reject) => {

    const msInterval = 100;

    /**
     * Schedules a new polling attempt and consumes some `msTimeout`.
     */
    const retry = () => {
        setTimeout(poll, msInterval);
        msTimeout -= msInterval;
    };

    /**
     * Queries the DOM for the element. Retries until `msTimeout` reaches 0.
     */
    const poll = () => {
        const element = document.querySelector(selector);
        if (!element) {
            msTimeout > 0 ? retry() : reject();
        } else {
            resolve(element);
        }
    };

    poll();
});

if (isMaterialDesign()) {
    startupMaterialDesign();
} else {
    startupLegacy();
}

// ===============
// Rendering (WIP)
// ===============

/**
 * Adds tag elements to the DOM.
 * 
 * @param {string[]} tags
 */
const addTagsToDom = tags => {
    legacyDisplayTags(tags);
};

/**
 * Ensures that previous tags don't remain visible after the video has changed.
 */
const clearTags = () => {
    legacyDisplayTags([]);
};

/**
 * Displays a generic error message.
 * 
 * @param {Error|*} e
 */
const showError = e => {
    legacyDisplayTags(["ERROR"], true);
};

// ===============
// Legacy DOM code
// ===============
// 
// The tag loading code you've seen above was quickly rewritten to restore basic
// functionality to the extension. A change in YouTube's code had broken the old
// and hacky script, so I moved to their shiny new official API instead.
// 
// The code below, however... is still the same old pile of hacks with dated JS
// syntax that accumulated over 2013-2017. Right now I don't have time to 
// rewrite that too. Sorry. But it works! Usually.

var IS_MATERIAL = isMaterialDesign();

var TAG_ELEMENT_STYLE = "display: inline-block;"
    + "padding-top: 4px;"
    + "padding-bottom: 4px;"
    + "padding-right: 15px;";

var OUTPUT_ELEMENT_ID = "TFYT_OUTPUT";
var OUTPUT_ELEMENT_STYLE_OLD = "float: left; width: 70%;";

var MATERIAL_MORE_BUTTON_SELECTOR = "#meta paper-button#more";
var MATERIAL_LESS_BUTTON_SELECTOR = "#meta paper-button#less";

var MATERIAL_LINK_ELEMENT_STYLE = "text-decoration: none;"
    + "color: hsl(206.1, 79.3%, 52.7%);"
    + "cursor: pointer;"
    + "display: inline-block";

/**
 * Displays the given tags on the current video page.
 */
function legacyDisplayTags(tags) {

    var outputElement = tryLoadOutputElement();

    if (!outputElement) {

        // The YouTube™ UI was probably not fully initialized yet, so the output element could
        // not be created. Either that, or they made a breaking change to the code. Wait a
        // moment and try again.
        // 
        // Note: if the browser tab isn't currently open, the UI may not even get initialized
        // until it's (re)opened. That's why there's no limit to the number of retries.

        setTimeout(function () {
            legacyDisplayTags(tags);
        }, 1000);

        return;
    }

    // (Re)set initial output element state
    // ====================================

    outputElement.innerHTML = "";

    if (IS_MATERIAL) {

        // Apply spacing ONLY if tags are present, so there's no large blank space in the page:

        outputElement.style.marginTop = tags.length > 0 ? "20px" : "0";
        outputElement.style.marginBottom = tags.length > 0 ? "10px" : "0";

        tryCollapseMaterialOutputElement(outputElement);
    }

    // Generate tag elements
    // =====================

    for (var i = 0; i < tags.length; i++) {

        var tag = tags[i];

        // Create span:

        var tagElement = document.createElement("span");
        tagElement.setAttribute("style", TAG_ELEMENT_STYLE);
        outputElement.appendChild(tagElement);

        // Create a[href="/results?search_query={tag}"]:

        var linkElement = document.createElement("a");
        linkElement.setAttribute("target", "_blank");
        linkElement.setAttribute("href", "/results?search_query=" + encodeURIComponent(tag));
        linkElement.innerText = tag;
        tagElement.appendChild(linkElement);

        if (IS_MATERIAL) {
            linkElement.setAttribute("style", MATERIAL_LINK_ELEMENT_STYLE);
        }

        // Create invisible comma, for copy-paste convenience:

        var commaElement = document.createElement("span");
        commaElement.setAttribute("style", "opacity: 0;");
        commaElement.innerText = ", ";
        tagElement.appendChild(commaElement);
    }
}

/**
 * Attempts to load and return the tags output element. Returns `null` on failure.
 */
function tryLoadOutputElement() {

    var outputElement = document.getElementById(OUTPUT_ELEMENT_ID);

    if (outputElement) {
        return outputElement;
    }

    return IS_MATERIAL ? tryLoadMaterialOutputElement() : tryLoadOldOutputElement();
}

/**
 * Attempts to create and return a tags output element in the material design layout.
 */
function tryLoadMaterialOutputElement() {

    var containerElement = document.querySelector("ytd-expander ytd-metadata-row-container-renderer");

    if (!containerElement) {
        return null;
    }

    // The official video metadata elements are found in a "#container" element, which can be
    // expanded/collapsed with buttons. Ideally, the tags would be inside this collapsible
    // element, and everything would work as intended out of the box.
    // 
    // Unfortunately, the "#container" element isn't just hidden on collapse: all its child
    // elements are deleted from the DOM. This makes it impractical to place the tags inside 
    // that element - they'd be lost on collapse.
    // 
    // The simplest workaround is just to place the tags in their own <div>...:

    var outputElement = document.createElement("div");
    outputElement.id = OUTPUT_ELEMENT_ID;
    containerElement.appendChild(outputElement);

    // ...and hook them up to the expand/collapse buttons separately:

    var showMoreButton = document.querySelector(MATERIAL_MORE_BUTTON_SELECTOR);
    var showLessButton = document.querySelector(MATERIAL_LESS_BUTTON_SELECTOR);

    if (showMoreButton && showLessButton) {

        showMoreButton.addEventListener("click", function (e)  {
            outputElement.style.display = "block";
        });

        showLessButton.addEventListener("click", function (e) {
            outputElement.style.display = "none";
        });
    }

    return outputElement;
}

/**
 * Attempts to create and return a tags output element in the old layout.
 */
function tryLoadOldOutputElement() {

    var containerElement = document.querySelector("ul.watch-extras-section");

    if (!containerElement) {
        return null;
    }

    // Create li.watch-meta-item > div.content:

    var outputElement = document.createElement("div");
    outputElement.id = OUTPUT_ELEMENT_ID;
    outputElement.className = "content";
    outputElement.setAttribute("style", OUTPUT_ELEMENT_STYLE_OLD);

    // Create li.watch-meta-item > h4.title:

    var titleElement = document.createElement("h4");
    titleElement.setAttribute("class", "title");
    titleElement.innerText = "Tags";

    // Create li.watch-meta-item:

    var tagsElement = document.createElement("li");
    tagsElement.className = "watch-meta-item yt-uix-expander-body";
    tagsElement.appendChild(titleElement);
    tagsElement.appendChild(outputElement);
    
    containerElement.appendChild(tagsElement);

    return outputElement;
}

/**
 * Collapses the output element for the material design layout, if the YouTube™ UI allows it.
 */
function tryCollapseMaterialOutputElement(outputElement) {

    outputElement.style.display = "none";

    // If a video has no metadata, its expand/collapse buttons are hidden, which would of
    // course prevent the user from viewing the tags that were collapsed by the line above.
    // 
    // Unfortunately, this only becomes apparent/definitive once the YouTube™ UI is fully
    // loaded up. Which isn't necessarily the case when this function runs. So the check below
    // is set up with a timeout. And repeated a few times for good measure.
    
    function expandIfButtonsAreHidden() {

        var isMoreButtonHidden = document
            .querySelector(MATERIAL_MORE_BUTTON_SELECTOR)
            .getAttribute("hidden") !== null;

        var isLessButtonHidden = document
            .querySelector(MATERIAL_LESS_BUTTON_SELECTOR)
            .getAttribute("hidden") !== null;

        if (isMoreButtonHidden) {
            outputElement.style.display = "block";
        } else if (!isMoreButtonHidden && isLessButtonHidden) {
            outputElement.style.display = "none";
        }
    }

    setTimeout(expandIfButtonsAreHidden, 500);
    setTimeout(expandIfButtonsAreHidden, 1000);
    setTimeout(expandIfButtonsAreHidden, 3000);
}
