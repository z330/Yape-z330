let usernameInput = document.getElementById('username');
let passwordInput = document.getElementById('password');
let serverIpInput = document.getElementById('serverIp');
let serverPortInput = document.getElementById('serverPort');
let serverPathInput = document.getElementById('serverPath');
let useHTTPSInput = document.getElementById('useHTTPS');
let spinnerDiv = document.getElementById('spinnerDiv');
let loginStatusOKDiv = document.getElementById('loginStatusOK');
let loginStatusKODiv = document.getElementById('loginStatusKO');
let currentURL = document.getElementById('currentURL');

let saveButton = document.getElementById('saveButton');
let loginButton = document.getElementById('loginButton');
let loginButtonModal = document.getElementById('loginButtonModal');
let alertDanger = document.getElementById('alertDanger');
let badWordsFilterTextarea = document.getElementById('badWordsFilter');


let loginModal = $('#loginModal');


function enableSpinner() {
    spinnerDiv.innerHTML = `
        <div class="spinner-border text-primary m-3"></div>
        <div>Checking status...</div>
    `;
}

function disableSpinner() {
    spinnerDiv.innerHTML = ``;
}

function setDangerMessage(message, timeout=3000) {
    if (!message) {
        alertDanger.hidden = true;
        return;
    }
    alertDanger.innerText = message;
    alertDanger.hidden = false;
    if (timeout > 0) {
        setTimeout(function() {
            alertDanger.hidden = true;
            alertDanger.innerText = '';
        }, timeout);
    }
}

function getProtocol() {
    return useHTTPSInput.checked ? 'https' : 'http';
}

function updateLoggedInStatus(callback) {
    saveButton.disabled = true;
    loginStatusOKDiv.hidden = true;
    loginStatusKODiv.hidden = true;
    loginButton.hidden = true;
    enableSpinner();
    isLoggedIn(function(loggedIn, unauthorized, error) {
        disableSpinner();
        loginStatusOKDiv.hidden = !loggedIn;
        loginStatusKODiv.hidden = loggedIn;
        loginStatusKODiv.innerHTML = `<i class="fa fa-times small mr-3"></i>`
        if (!loggedIn && unauthorized) {
            loginStatusKODiv.innerHTML += `Please log in`;
        } else {
            loginStatusKODiv.innerHTML += error ? error : `You are not logged in`;
        }
        loginButton.hidden = !unauthorized;
        saveButton.disabled = false;
        if (callback) callback();
    });
}

function requestPermission(callback) {
    chrome.permissions.contains({
        origins: [`${origin}/`]
    }, function(result) {
        if (!result) {
            chrome.permissions.request({
                origins: [`${origin}/`]
            }, function(granted) {
                if (callback) {
                    if (!granted) {
                        alert('Not granting this permission will make the extension unusable.');
                    }
                    callback(granted);
                }
            });
        } else if (callback) {
            callback(true);
        }
    });
}

function validHost(str) {
    let pattern = new RegExp('^((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+ // domain name
        '((\\d{1,3}\\.){3}\\d{1,3}))$'); // OR ip (v4) address
    return !!pattern.test(str);
}

function validateForm() {
    // Host
    const value = serverIpInput.value;
    const isLocalhost = (value === 'localhost');
    const isServerIPValid = validHost(value) || isLocalhost;
    if (isServerIPValid) {
        serverIpInput.classList.remove('is-invalid');
    } else {
        serverIpInput.classList.add('is-invalid');
        saveButton.disabled = true;
    }
    // Port
    const isValidPort = /\d+/.test(serverPortInput.value);
    if (isValidPort) {
        serverPortInput.classList.remove('is-invalid');
    } else {
        serverPortInput.classList.add('is-invalid');
        saveButton.disabled = true;
    }
    // Path
    const isValidPath = /^((\/[.\w-]+)*\/{0,1}|\/)$/.test(serverPathInput.value);
    if (isValidPath) {
        serverPathInput.classList.remove('is-invalid');
    } else {
        serverPathInput.classList.add('is-invalid');
        saveButton.disabled = true;
    }
}

function requireSaving() {
    updateCurrentURL();
    if (xhr !== null) {
        xhr.abort();
    }
    if (serverIpInput.value === serverIp &&
        parseInt(serverPortInput.value) === parseInt(serverPort) &&
        useHTTPSInput.checked === (serverProtocol === 'https') &&
        serverPathInput.value === serverPath) {
        updateLoggedInStatus();
    } else {
        saveButton.disabled = false;
        loginStatusOKDiv.hidden = true;
        loginStatusKODiv.hidden = true;
        loginButton.hidden = true;
    }
    validateForm();
}

function updateCurrentURL() {
    portString = `:${serverPortInput.value}`;
    if ((useHTTPSInput.checked && serverPortInput.value === '443') || (!useHTTPSInput.checked && serverPortInput.value === '80')) {
        portString = '';
    }
    currentURL.innerHTML = `${useHTTPSInput.checked ? 'https' : 'http'}://${serverIpInput.value}${portString}${serverPathInput.value}`;
}

saveButton.onclick = function (ev) {
    setOrigin(serverIpInput.value, serverPortInput.value, getProtocol(), serverPathInput.value, badWordsFilterTextarea.value, function () {
        requestPermission(function (granted) {
            updateLoggedInStatus();
        });
    });
};


function saveBadWords(badWords, callback) {
    chrome.storage.local.set({ badWords: badWords }, function () {
        if (callback) callback();
    });
}

loginButton.onclick = function(ev) {
    loginModal.modal('show');
}

loginButtonModal.onclick = function(ev) {
    setDangerMessage('');
    login(usernameInput.value, passwordInput.value, function(success, error_msg) {
        if (success) {
            loginModal.modal('hide');
            updateLoggedInStatus();
        } else {
            setDangerMessage(error_msg, 0);
        }
    });
}

$(document).ready(function(){
    $('[data-toggle="tooltip"]').tooltip();
});

pullStoredData(function () {
    serverIpInput.value = serverIp;
    serverPortInput.value = serverPort;
    serverPathInput.value = serverPath;
    useHTTPSInput.checked = serverProtocol === 'https';
    badWordsFilterTextarea.value = badWords || '';  // Set bad words from storage

    updateCurrentURL();

    serverIpInput.oninput = requireSaving;
    serverPortInput.oninput = requireSaving;
    useHTTPSInput.oninput = requireSaving;
    serverPathInput.oninput = requireSaving;
    badWordsFilterTextarea.oninput = requireSaving;  // Make sure changes to bad words also trigger saving

    updateLoggedInStatus();
});


