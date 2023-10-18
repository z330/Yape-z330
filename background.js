importScripts('js/storage.js');

const notify = function (title, message) {
    return chrome.notifications.create('', {
        type: 'basic',
        title: title || 'Yape',
        message: message || '',
        iconUrl: './images/icon.png',
    });
}

const loadToastr = function (tab, callback) {
    chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ['css/toastr.min.css']
    }, function () {
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['js/lib/jquery-3.5.1.min.js', 'js/lib/toastr.min.js']
        }, function () {
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    toastr.options = {
                        closeButton: false,
                        newestOnTop: false,
                        progressBar: false,
                        positionClass: 'toastr-top-right',
                        containerId: 'toastr-container',
                        toastClass: 'toastr',
                        iconClasses: {
                            error: 'toastr-error',
                            info: 'toastr-info',
                            success: 'toastr-success',
                            warning: 'toastr-warning'
                        },
                        iconClass: 'toastr-info',
                        titleClass: 'toastr-title',
                        messageClass: 'toastr-message',
                        closeClass: 'toastr-close-button',
                        timeOut: 8000
                    };
                }
            }, function () {
                callback();
            });
        });
    });
}

const sendToast = function (tab, type, message) {
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (type, message) => {
            toastr.remove();
            toastr[type](message);
        },
        args: [type, message]
    });
}

const removeWords = [ // should be moved to the config screen to allow users to add words to exlude from filenames
    "[Bitsearch.to]",
    // Bad Words List
];


const parseNameFromUrl = (url) => {
    // Extract name from dn var in magnet link
    if (url.startsWith('magnet:?')) {
        let match = url.match(/&dn=([^&]+)/);
        if (match) return decodeURIComponent(match[1].split('&')[0]); 
    }

    // Extract the filename if its a .torrent link
    if (url.endsWith('.torrent')) {
        return url.split('/').pop();
    }

    return url.split('/').pop();
}

const cleanFileName = (name) => {
    removeWords.forEach(word => {
        name = name.replace(new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '');
    });

    // limit the file name size so we don't have issues
    let cleanName = name.slice(0, 255);

    // remove spaces from folder names who uses spaces in a folder names come on
    cleanName = cleanName.replace(/\s/g, '_');

    // make filename safe for linux fole systems
    return cleanName.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^_+|_+$/g, ''); 
}

const downloadLink = function (info, tab) {
    const fileName = cleanFileName(parseNameFromUrl(info.linkUrl));
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    fetch(`${origin}/api/statusServer`, { signal: controller.signal })
        .then(response => response.json())
        .then(json => {
            clearTimeout(timeoutId);
            if (json.hasOwnProperty('error')) {
                if (json.error === 'Forbidden') sendToast(tab, 'error', `Invalid credentials, make sure you are logged in`);
                else sendToast(tab, 'error', `Server unreachable`);
                return;
            }
            fetch(`${origin}/api/checkURLs?urls=["${encodeURIComponent(info.linkUrl)}"]`)
                .then(response => response.json())
                .then(json => {
                    if (json.hasOwnProperty('error')) {
                        sendToast(tab, 'error', `Error checking url: ${json}`);
                        return;
                    }
                    fetch(`${origin}/api/addPackage?name="${fileName}"&links=["${encodeURIComponent(info.linkUrl)}"]`)
                        .then(response => response.json())
                        .then(json => {
                            if (json.hasOwnProperty('error')) {
                                sendToast(tab, 'error', `Error requesting download: ${json}`);
                                return;
                            }
                            sendToast(tab, 'success', 'Download added successfully');
                        });
                });
        })
        .catch(e => sendToast(tab, 'error', `Server unreachable`));
}

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'yape',
        title: 'Download with Yape',
        contexts: ['link']
    });
});

chrome.runtime.onMessage.addListener(data => {
    if (data.type === 'notification') {
        notify(data.title, data.message);
    }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if ('yape' === info.menuItemId) {
        loadToastr(tab, function () {
            pullStoredData(function () {
                sendToast(tab, 'info', 'Requesting download...');
                downloadLink(info, tab);
            });
        });
    }
});
