// ==UserScript==
// @name         Geoguessr Resolver Hack (Works in all game modes)
// @namespace    http://tampermonkey.net/
// @version      10.4_Beta
// @description  Features: Automatically score 5000 Points | Score randomly between 4500 and 5000 points | Open in Google Maps | See enemy guess Distance
// @author       0x978
// @match        https://www.geoguessr.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=geoguessr.com
// @grant        GM_webRequest
// ==/UserScript==

let cancelXpFarm = false;
let firstGuess = true;

window.alert = function (message) { // Devs tried to overwrite alert to detect script. I had already stopped using alert, but i'd rather they didn't override this anyway.
    nativeAlert(message)
};

const originalFetch = window.fetch;
window.fetch = function (url, options) {
    if (url === "https://www.geoguessr.com/api/v4/cd0d1298-a3aa-4bd0-be09-ccf513ad14b1") { // devs using this endpoint for Anticheat. Block all calls to it.
        return
    }
    return originalFetch.call(this, url, options);
};

async function getAddress(lat, lon) {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`)
    return await response.json();
}

function displayLocationInfo() {
    const coordinates = coordinateClimber()
    // api call with the lat lon to retrieve data.
    getAddress(coordinates[0], coordinates[1]).then(data => {
        alert(`
        Country: ${data.address.country}
        County: ${data.address.county}
        City: ${data.address.city}
        Road: ${data.address.road}
        State: ${data.address.state}
        Postcode: ${data.address.postcode}
        Village/Suburb: ${(data.address.village || data.address.suburb)}

       Postal Address: ${data.display_name}
        `)
    });

}

function placeMarker(safeMode, skipGet, coords, xpMode) {
    const isPanic = document.getElementsByClassName("coordinate-map_canvasContainer__7d8Yw")[0]
    if(isPanic){panicPlaceMarker(isPanic); return;}
    const isStreaks = document.getElementsByClassName("guess-map__canvas-container")[0] === undefined
    let location = skipGet ? coords : coordinateClimber(isStreaks)
    if (isStreaks) {
        placeMarkerStreaksMode(location)
        return;
    }
    let [lat, lng] = location

    if (safeMode) {
        const sway = [Math.random() > 0.5,Math.random() > 0.5]
        const multiplier = xpMode ? Math.random() * 6 : Math.random() * 4
        console.log(multiplier)
        const horizontalAmount = Math.random() * multiplier
        const verticalAmount = Math.random() * multiplier
        sway[0] ? lat += verticalAmount : lat -= verticalAmount
        sway[1] ? lng += horizontalAmount : lat -= horizontalAmount
    }

    const element = document.getElementsByClassName("guess-map__canvas-container")[0] // html element containing needed props.
    const keys = Object.keys(element) // all keys
    const key = keys.find(key => key.startsWith("__reactFiber$")) // the React key I need to access props
    const place = element[key].return.memoizedProps.onMarkerLocationChanged // getting the function which will allow me to place a marker on the map

    flag = false;
    place({lat: lat, lng: lng}) // placing the marker on the map at the correct coordinates given by getCoordinates(). Must be passed as an Object.
    toggleClick(({lat: lat, lng: lng}))
    displayDistanceFromCorrect({lat: lat, lng: lng})
    injectOverride()
}

function placeMarkerStreaksMode(code) {
    let element = document.getElementsByClassName("region-map_map__5e4h8")[0] // this map is unique to streaks mode, however, is similar to that found in normal modes.
    if(!element){
        element = document.getElementsByClassName("region-map_map__7jxcD")[0]
    }
    const keys = Object.keys(element)
    const reactKey = keys.find(key => key.startsWith("__reactFiber$"))
    const placeMarkerFunction = element[reactKey].return.memoizedProps.onRegionSelected // This map works by selecting regions, not exact coordinates on a map, which is handles by the "onRegionSelected" function.

    if(typeof code !== "string"){
        let [lat,lng] = code
        getAddress(lat, lng).then(data => { // using API to retrieve the country code at the current coordinates.
            const countryCode = data.address.country_code
            placeMarkerFunction(countryCode) // passing the country code into the onRegionSelected method.
        })
        return
    }

    placeMarkerFunction(code)
}

function panicPlaceMarker(element){ // Currently only used in map runner.
    const keys = Object.keys(element)
    const key = keys.find(key => key.startsWith("__reactFiber$"))
    const props = element[key]

    const clickProperty = props.return.memoizedProps.map.__e3_.click // taking the maps click property directly.
    const clickFunction = clickProperty[getDynamicIndex(Object.keys(clickProperty),clickProperty)].xe
    console.log(clickFunction)
    let [lat,lng] = coordinateClimber()

    // for some reason, submitting near-perfect guesses causes Chromium browsers to crash, the following will offset it to avoid this.
    // There is probably some other way to avoid this, but I have no idea why this happens. See GitHub issue.
    lat += 0.1
    lng += 0.1

    let y = {
        "latLng": {
            "lat": () => lat,
            "lng": () =>  lng,
        }
    }
    clickFunction(y)
}

function getDynamicIndex(indexArray,clickProperty){
    for(let i = 0; i < indexArray.length;i++){
        if(clickProperty[indexArray[i]]?.xe.toString().slice(0,20) === "l=>{let e={lat:l.lat"){
            return indexArray[i]
        }
    }
    alert("Maprunner Placer failed. \n Please report this on GitHub or Greasyfork.")
}

function coordinateClimber(isStreaks){
    let timeout = 10
    let path = document.querySelector('div[data-qa="panorama"]');
    while (timeout > 0){
        const props = path[Object.keys(path).find(key => key.startsWith("__reactFiber$"))]
        const checkReturns = iterateReturns(props,isStreaks)
        if(checkReturns){
            return checkReturns
        }
        path = path.parentNode
        timeout--
    }
    alert("Failed to find co-ordinates. Please make an issue on GitHub or GreasyFork. " +
        "Please make sure you mention the game mode in your report.")
}

function iterateReturns(element,isStreaks){
    let timeout = 10
    let path = element
    while(timeout > 0){
        if(path){
            const coords = checkProps(path.memoizedProps,isStreaks)
            if(coords){
                return coords
            }
        }
        if(!path["return"]){
            return
        }
        path = path["return"]
        timeout--
    }
}

function checkProps(props,isStreaks){
    if(props?.panoramaRef){
        const found = props.panoramaRef.current.location.latLng
        return [found.lat(),found.lng()]
    }
    if(props.streakLocationCode && isStreaks){
        return props.streakLocationCode
    }
    if(props.gameState){
        const x = props.gameState[props.gameState.rounds.length-1]
        return [x.lat,x.lng]
    }
    if(props.lat){
        return [props.lat,props.lng]
    }
}

function mapsFromCoords() { // opens new Google Maps location using coords.
    const [lat, lon] = coordinateClimber()
    if (!lat || !lon) {
        return;
    }
    window.open(`https://www.google.com/maps/place/${lat},${lon}`);
}

function getGuessDistance(manual) {
    const coords = coordinateClimber()
    const clat = coords[0] * (Math.PI / 180)
    const clng = coords[1] * (Math.PI / 180)
    const y = document.getElementsByClassName("guess-map__canvas-container")[0]
    const keys = Object.keys(y)
    const key = keys.find(key => key.startsWith("__reactFiber$"))
    const props = y[key]
    const user = manual ?? props.return.memoizedProps.markers[0]
    if (!coords || !user) {
        return null
    }
    const ulat = user.lat * (Math.PI / 180)
    const ulng = user.lng * (Math.PI / 180)

    const distance = Math.acos(Math.sin(clat) * Math.sin(ulat) + Math.cos(clat) * Math.cos(ulat) * Math.cos(ulng - clng)) * 6371
    return distance
}

function xpFarm(guessDelay, buttonTime) {
    if (!cancelXpFarm) {
        setInterval(() => {
            if (firstGuess) {
                placeMarker(true, false, undefined, true);
                firstGuess = false;
            }
    
            setInterval(() => {
                const button = document.querySelector('[data-qa="close-round-result"]');
                if (button) {
                    firstGuess = true;
                    button.click();
                }
                setInterval(() => {
                    const playAgainButton = document.querySelector('[data-qa="play-again-button"]');
                    if (playAgainButton) {
                        playAgainButton.click();
                    }
                }, buttonTime * 1000)
            }, buttonTime * 1000)
        }, guessDelay * 1000);
    }
}

function displayDistanceFromCorrect(manual) {
    let unRoundedDistance = getGuessDistance(manual) // need unrounded distance for precise calculations later.
    let distance = Math.round(unRoundedDistance)
    if (distance === null) {
        return
    }
    let text = `${distance} km (${Math.round(distance * 0.621371)} miles)`
    setGuessButtonText(text)
}

function setGuessButtonText(text) {
    let x = document.querySelector('button[data-qa="perform-guess"]');
    if(!x){
        return null}
    x.innerText = text
}

function toggleClick(coords) { // prevents user from making 5k guess to prevent bans.
    const disableSpaceBar = (e) => {
        if (e.keyCode === 32) {
            const distance = getGuessDistance()
            if ((distance < 1 || isNaN(distance)) && !flag) {
                e.stopImmediatePropagation();
                preventedActionPopup()
                document.removeEventListener("keyup", disableSpaceBar);
                flag = true
            }
        }
    };
    document.addEventListener("keyup", disableSpaceBar);
    setTimeout(() => {
        const distance = getGuessDistance()
        if ((distance < 1 || isNaN(distance)) && !flag) {
            let old = document.getElementsByClassName("button_button__CnARx button_variantPrimary__xc8Hp")[0][Object.keys(document.getElementsByClassName("button_button__CnARx button_variantPrimary__xc8Hp")[0])[1]].onClick
            document.getElementsByClassName("button_button__CnARx button_variantPrimary__xc8Hp")[0][Object.keys(document.getElementsByClassName("button_button__CnARx button_variantPrimary__xc8Hp")[0])[1]].onClick = (() => {
                flag = true
                preventedActionPopup()
                document.getElementsByClassName("button_button__CnARx button_variantPrimary__xc8Hp")[0][Object.keys(document.getElementsByClassName("button_button__CnARx button_variantPrimary__xc8Hp")[0])[1]].onClick = (() => old())
            })
        }
    }, 500)
}

function preventedActionPopup() {
    alert(`Geoguessr Resolver has prevented you from making a perfect guess.

    Making perfect guesses will very likely result in a ban from competitive.

    Press "guess" again to proceed anyway.`)
}

function injectOverride() {
    document.getElementsByClassName("guess-map__canvas-container")[0].onpointermove = (() => { // this is called wayyyyy too many times (thousands) but fixes a lot of issues over using onClick.
        displayDistanceFromCorrect()
    })
}

function getBRCoordinateGuesses() {
    const gameRoot = document.getElementsByClassName("game_root__2vV1H")[0]
    const props = gameRoot[Object.keys(document.getElementsByClassName("game_root__2vV1H")[0])[0]]
    const gameProps = props.return.return.memoizedProps.value.gameState
    const roundNumber = gameProps.currentRoundNumber
    const playerArray = gameProps.players

    let bestGuessDistance = Number.MAX_SAFE_INTEGER

    playerArray.forEach((player) => {
        const guesses = player.coordinateGuesses
        if(guesses){
            const guess = guesses[guesses.length - 1]
            if(guess && guess.roundNumber === roundNumber){
                if(guess.distance < bestGuessDistance){
                    bestGuessDistance = guess.distance
                }
            }
        }
    })

    if (bestGuessDistance === Number.MAX_SAFE_INTEGER) {
        return null;
    }
    return Math.round(bestGuessDistance / 1000)
}

function displayBRGuesses(){
    const distance = getBRCoordinateGuesses()
    if (distance === null) {
        alert("There have been no guesses this round")
        return;
    }
    alert(`The best guess this round is ${distance} km from the correct location. (This may include your guess)`)
}

function setInnerText(){
    const text = `
                Geoguessr Resolver Loaded Successfully

                IMPORTANT GEOGUESSR RESOLVER UPDATE INFORMATION (I predicted it lol): 
                
                Geoguessr Duels now has a replay mode. Try to look legit. Use the google map option more.
                https://www.reddit.com/r/geoguessr/comments/16oganx/exciting_update_duel_replays_now_available_in/
                
                 MAPRUNNER IS NOW SUPPORTED (BETA). Please try it out and report issues on GitHub
                `
    if(document.getElementsByClassName("header_logo__vV0HK")[0]){
        document.getElementsByClassName("header_logo__vV0HK")[0].innerText = text
    }
}

GM_webRequest([
    { selector: 'https://www.geoguessr.com/api/v4/trails', action: 'cancel' },
]);

let onKeyDown = (e) => {
    if (e.keyCode === 49) {
        e.stopImmediatePropagation(); // tries to prevent the key from being hijacked by geoguessr
        placeMarker(true, false, undefined, false)
    }
    if (e.keyCode === 50) {
        e.stopImmediatePropagation();
        placeMarker(false, false, undefined, false)
    }
    if (e.keyCode === 51) {
        e.stopImmediatePropagation();
        displayLocationInfo()
    }
    if (e.keyCode === 52) {
        e.stopImmediatePropagation();
        mapsFromCoords()
    }
    if (e.keyCode === 53) {
        e.stopImmediatePropagation();
        displayBRGuesses()
    }
    if (e.keyCode === 54) {
        e.stopImmediatePropagation();
        let roundTime = parseInt(prompt("Enter length of round in seconds"))
        let minGuessDelay = parseInt(roundTime - 12);
        let maxGuessDelay = parseInt(roundTime - 3);
        let guessDelay = parseInt(Math.floor(Math.random() * (maxGuessDelay - minGuessDelay + 1) + minGuessDelay));
        let buttonTime = parseInt(Math.floor(Math.random() * (4 - 2 + 1) + 2));
        setTimeout(() => {
            xpFarm(guessDelay, buttonTime);
        }, 2000);
    }
    if (e.keyCode === 55) {
        e.stopImmediatePropagation();
        if (!cancelXpFarm) {
            alert("XP Farm Currently Not Running");
        } else {
            alert("Terminating XP Farm");
            cancelXpFarm = true;
        }
    }
}
setInnerText()
document.addEventListener("keydown", onKeyDown);
let flag = false