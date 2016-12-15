var Alexa = require('alexa-sdk');
var ical = require('ical');
var http = require('http');
var utils = require('util');
var moment = require('moment-timezone');    

var states = {
    SEARCHMODE: '_SEARCHMODE',
    DESCRIPTION: '_DESKMODE',
};
// local variable holding reference to the Alexa SDK object
var alexa;

//OPTIONAL: replace with "amzn1.ask.skill.[your-unique-value-here]";
var APP_ID = 'amzn1.ask.skill.b1da7508-f82c-448f-ba6a-ce150bf990a6'; 

// URL to get the .ics from, in this instance we are getting from Stanford however this can be changed
// var URL = "http://events.stanford.edu/eventlist.ics";
var URL = "http://www.bcp.org/_infrastructure/ICalendarHandler.ashx?Tokens=46064,221576,993617,118391,684604,199204,859354,118305,861526,462744,527179,806159,810549,482902,777044,493136,937568,546208,111330,126702,417450";
// var URL = "http://lanyrd.com/topics/nodejs/nodejs.ics";

// Skills name 
var skillName = "Bellarmine calendar:";

// Message when the skill is first called
var welcomeMessage = "Hello! You can ask for the events today. search for events by date. search for a type of event. or say help. What would you like? ";

// Message for help intent
var HelpMessage = "Here are some things you can say: Is there an event today? What are the events next week? When is the next concert?  What would you like to know?";

// Error message when date isn't provided
var noDateProvidedMessage = "Sorry, you didn't give me a date. " + HelpMessage;

var descriptionStateHelpMessage = "Here are some things you can say: Tell me about event one";

// Used when there is no data within a time period
var NoDataMessage = "Sorry there aren't any events scheduled. Would you like to search again?";

// Used to tell user skill is closing
var shutdownMessage = "Ok see you again soon.";

// Message used when only 1 event is found allowing for difference in punctuation 
var oneEventMessage = "There is 1 event ";

// Message used when more than 1 event is found allowing for difference in punctuation 
var multipleEventMessage = "There are %d events ";

// text used after the number of events has been said
var scheduledEventMessage = "scheduled for this time frame. I've sent the details to your Alexa app: ";

var firstThreeMessage = "Here are the first %d. ";

// the values within the {} are swapped out for variables
var eventSummary = "The %s event is, %s on %s ";

// Only used for the card on the companion app
var cardContentSummary = "%s on %s ";

// More info text
var haveEventsRepromt = "Give me an event number to hear more information.";

// Error if a date is out of range
var dateOutOfRange = "Date is out of range please choose another date";

// Error if a event number is out of range
var eventOutOfRange = "Event number is out of range please choose another event";

// Used when an event is asked for
var descriptionMessage = "Here's the description: ";
var locationMessage = "The event is at ";
var startingTimeMessage = "It is on ";

// Used when an event is asked for
var killSkillMessage = "Ok, great, see you next time.";

var eventNumberMoreInfoText = "You can say the event number for more information.";

// used for title on companion app
var cardTitle = "Events";

// output for Alexa
var output = "";

// stores events that are found to be in our date range
var relevantEvents = new Array();

// Adding session handlers
var newSessionHandlers = {
    'LaunchRequest': function () {
        console.log("Launched without an intent");
        logRequest(this);
        this.handler.state = states.SEARCHMODE;
        this.emit(':ask', skillName + " " + welcomeMessage, welcomeMessage);
    },
    'IntentRequest': function () {
        console.log("Launched with an intent");
        this.handler.state = states.SEARCHMODE;
        if (this.event.request.intent.name === 'searchIntent') {
            this.emit('searchIntent');
        } else if (this.event.request.intent.name === 'searchKeywordIntent') {
            this.emit('searchKeywordIntent');
        }
    },
    'searchIntent': function () {
        console.log("Launched with a search intent");
        logRequest(this);
        this.handler.state = states.SEARCHMODE;
        searchHandler(this);
    },
    'searchKeywordIntent': function () {
        console.log("Launched with a search keyword intent");
        logRequest(this);
        this.handler.state = states.SEARCHMODE;
        searchKeywordHandler(this);
    },
    'Unhandled': function () {
        console.log("Reached handler for Unhandled event");
        logRequest(this);
        this.handler.state = states.SEARCHMODE;
        this.emit(':ask', skillName + " " + welcomeMessage, welcomeMessage);
    }
};

// Create a new handler with a SEARCH state
var startSearchHandlers = Alexa.CreateStateHandler(states.SEARCHMODE, {
    'AMAZON.YesIntent': function () {
        logRequest(this);
        output = welcomeMessage;
        alexa.emit(':ask', output, welcomeMessage);
    },

    'AMAZON.NoIntent': function () {
        logRequest(this);
        this.emit(':tell', shutdownMessage);
    },

    'AMAZON.RepeatIntent': function () {
        logRequest(this);
        output = welcomeMessage;
        this.emit(':ask', output, HelpMessage);
    },

    'searchIntent': function () {
        logRequest(this);
        searchHandler(this);
    },

    'searchKeywordIntent': function () {
        logRequest(this);
        searchKeywordHandler(this);
    },

    'AMAZON.HelpIntent': function () {
        logRequest(this);
        output = HelpMessage;
        this.emit(':ask', output, output);
    },

    'AMAZON.StopIntent': function () {
        logRequest(this);
        this.emit(':tell', killSkillMessage);
    },

    'AMAZON.CancelIntent': function () {
        logRequest(this);
        this.emit(':tell', killSkillMessage);
    },

    'SessionEndedRequest': function () {
        logRequest(this);
        this.emit('AMAZON.StopIntent');
    },

    'Unhandled': function () {
        console.log("Reached handler for Unhandled event (2)");
        logRequest(this);
        this.emit(':ask', HelpMessage, HelpMessage);
    }
});


// -------------- Logging for debugging purposes --------

function logRequest(alexaCall) {
    var requestType = alexaCall.event.request.type;
    console.log("NEW REQUEST");
    console.log("Request type: " + requestType);

    var intent = alexaCall.event.request.intent;
    if (intent != undefined) {
        var intentName = intent.name;
        console.log("Intent: " + intentName);

        if (intent.slots != undefined) {
            var date = alexaCall.event.request.intent.slots.date;
            if (date != undefined) {
                var dateValue = date.value;
                if (dateValue != undefined) {
                    console.log("Date slot: " + dateValue);
                } else {
                    console.log("No value for date slot");
                }
            }

            var keyword = alexaCall.event.request.intent.slots.keyword;
            if (keyword != undefined) {
                var keywordValue = keyword.value;
                if (keywordValue != undefined) {
                    console.log("Keyword slot: " + keywordValue);
                } else {
                    console.log("No value for keyword slot");
                }

            }
        } else {
            console.log("No slots provided");
        }
    } else {
        console.log("No intent provided");
    }

    console.log("Raw request: " + JSON.stringify(alexaCall,null,4));
}

// -------------- Search handlers ---------------


function searchKeywordHandler(alexaCall) {
     var keyword = alexaCall.event.request.intent.slots.keyword.value;

    // check if the keyword was recognized
    if (keyword != undefined) {

        console.log("Search by keyword: " + keyword);
        var dateSlotValue = alexaCall.event.request.intent.slots.date.value;

        // date is optional, so dateRange may be undefined
        var dateRange;
        if (dateSlotValue != undefined) {
            console.log("Date provided: " + dateSlotValue);
            dateRange = getDateFromSlot(dateSlotValue);
        }
        var parent = alexaCall; 
        searchByKeyword(keyword, dateRange, parent);
    } else {
        output = HelpMessage;
        console.log("Alexa output: " + output);
        alexaCall.emit(':ask', output, output);
    }
}


function searchHandler(alexaCall) {
    // Declare variables 
    var eventList = new Array();
    var slotValue = alexaCall.event.request.intent.slots.date.value;
    var parent = alexaCall;

    // check to make sure the date was provided 
    if (slotValue != undefined) {

        console.log("Event search by date: " + slotValue);

        // Using the iCal library I pass the URL of where we want to get the data from.
        ical.fromURL(URL, {}, function (err, data) {

           if (data != undefined) { 

                // Loop through all iCal data found       
                for (var k in data) {
                    if (data.hasOwnProperty(k)) {
                        var ev = data[k]
                        // console.log("Going through calendar entry: " + ev.summary + " (time: " + ev.start +")");
                        if (ev.summary != undefined) {
                            // Pick out the data relevant to us and create an object to hold it.
                            // TODO: Convert date/time to local timezone

                            var eventData = {
                                summary: removeTags(ev.summary),
                                location: removeTags(ev.location),
                                description: removeTags(ev.description),
                                start: ev.start
                            }
                            // add the newly created object to an array for use later.
                            eventList.push(eventData);
                        } else {
                            console.log("Undefined event summary. Skipping...");
                        }

                    }
                }
                // Check if we have data
                if (eventList.length > 0) {
                    // Read slot data and parse out a usable date 
                    var eventDate = getDateFromSlot(slotValue);
                    // Check we have both a start and end date
                    if (eventDate.startDate && eventDate.endDate) {
                        // initiate a new array, and this time fill it with events that fit between the two dates
                        relevantEvents = getEventsBetweenDates(eventDate.startDate, eventDate.endDate, eventList);

                        if (relevantEvents.length > 0) {
                            // change state to description
                            parent.handler.state = states.DESCRIPTION;

                            // Create output for both Alexa and the content card
                            var cardContent = "";
                            output = oneEventMessage;
                            if (relevantEvents.length > 1) {
                                output = utils.format(multipleEventMessage, relevantEvents.length);
                            }

                            output += scheduledEventMessage;

                            if (relevantEvents.length > 1) {
                                var numberOfEvents = Math.min(relevantEvents.length,3);
                                output += utils.format(firstThreeMessage, numberOfEvents);
                            }

                            if (relevantEvents[0] != null) {
                                var date = new Date(relevantEvents[0].start);
                                output += utils.format(eventSummary, "First", removeTags(relevantEvents[0].summary), dateStringForResponse(date) + ".");
                            }
                            if (relevantEvents[1]) {
                                var date = new Date(relevantEvents[1].start);
                                output += utils.format(eventSummary, "Second", removeTags(relevantEvents[1].summary), dateStringForResponse(date) + ".");
                            }
                            if (relevantEvents[2]) {
                                var date = new Date(relevantEvents[2].start);
                                output += utils.format(eventSummary, "Third", removeTags(relevantEvents[2].summary), dateStringForResponse(date) + ".");
                            }

                            for (var i = 0; i < relevantEvents.length; i++) {
                                var date = new Date(relevantEvents[i].start);
                                cardContent += utils.format(cardContentSummary, removeTags(relevantEvents[i].summary), dateStringForResponse(date)+ "\n\n");
                            }

                            output += eventNumberMoreInfoText;
                            console.log("Alexa output: " + output);
                            alexa.emit(':askWithCard', output, haveEventsRepromt, cardTitle, cardContent);
                        } else {
                            output = NoDataMessage;
                            console.log("Alexa output: " + output);
                            alexa.emit(':ask', output, output);
                        }
                    }
                    else {
                        output = NoDataMessage;
                        console.log("Alexa output: " + output);
                        alexa.emit(':ask', output, output);
                    }
                } else {
                    output = NoDataMessage;
                    console.log("Alexa output: " + output);
                    alexa.emit(':ask', output, output);
                }
            } else {
                console.log("iCal Error: " + err);
            }
        });
    } else {
        // date wasn't provided
        console.log("Error: no date was provided for search");
        output = noDateProvidedMessage;
        console.log("Alexa output: " + output);
        alexaCall.emit(':ask', output, HelpMessage);
    }
}


// -------------------------------------------------

// Create a new handler object for description state
var descriptionHandlers = Alexa.CreateStateHandler(states.DESCRIPTION, {
    'eventIntent': function () {

        var reprompt = " Would you like to hear another event?";
        var slotValue = this.event.request.intent.slots.number.value;

        // parse slot value
        var index = parseInt(slotValue) - 1;

        if (relevantEvents[index]) {

            // use the slot value as an index to retrieve description from our relevant array
            if (relevantEvents[index].description != undefined && relevantEvents[index].description != "") {
                output = descriptionMessage + removeTags(relevantEvents[index].description) + ". ";
            } else {
                output = descriptionMessage + removeTags(relevantEvents[index].summary)  + ". ";
            }

            // add location
            if (relevantEvents[index].location != undefined && relevantEvents[index].location != "") {
                output = output + locationMessage + removeTags(relevantEvents[index].location) + ". ";
            }

            // add start time
            output = output + startingTimeMessage + dateStringForResponse(relevantEvents[index].start);

            // TODO: add end time

            output += reprompt;

            console.log("Alexa output: " + output);
            this.emit(':askWithCard', output, reprompt, relevantEvents[index].summary, output);
        } else {
            console.log("Alexa output: " + eventOutOfRange);
            this.emit(':tell', eventOutOfRange);
        }
    },

    'AMAZON.HelpIntent': function () {
        this.emit(':ask', descriptionStateHelpMessage, descriptionStateHelpMessage);
    },

    'AMAZON.StopIntent': function () {
        this.emit(':tell', killSkillMessage);
    },

    'AMAZON.CancelIntent': function () {
        this.emit(':tell', killSkillMessage);
    },

    'AMAZON.NoIntent': function () {
        this.emit(':tell', shutdownMessage);
    },

    'AMAZON.YesIntent': function () {
        output = welcomeMessage;
        alexa.emit(':ask', eventNumberMoreInfoText, eventNumberMoreInfoText);
    },

    'SessionEndedRequest': function () {
        this.emit('AMAZON.StopIntent');
    },

    'Unhandled': function () {
        this.emit(':ask', HelpMessage, HelpMessage);
    }
});

// register handlers
exports.handler = function (event, context, callback) {
    alexa = Alexa.handler(event, context);
    // TODO: uncomment before submission
    // alexa.appId = APP_ID;
    alexa.registerHandlers(newSessionHandlers, startSearchHandlers, descriptionHandlers);
    alexa.execute();
};

// search by keyword within an optional date range
function searchByKeyword(keyword, dateRange, parent) {

    // Declare variables 
    var eventList = new Array();
    // var parent = this;

    // Using the iCal library, pass the URL of where we want to get the data from.
    ical.fromURL(URL, {}, function (err, data) {

       if (data != undefined) { 

            // Loop through all iCal data found  
            // TODO: refactor the following section and make it a new reusable function     
            for (var k in data) {
                if (data.hasOwnProperty(k)) {
                    var ev = data[k]
                    // console.log("Going through calendar entry: " + ev.summary + " (date: " + ev.start +")");
                    if (ev.summary != undefined) {
                        // Pick out the data relevant to us and create an object to hold it.
                        // TODO: convert start date to local timezone
                        // e.g. Thu May 25 2017 16:30:00 GMT+0000 (UTC)
                        var eventDate = new Date(ev.start);
                        // console.log("Local date/time" + eventDate.toLocaleString());

                        var eventData = {
                            summary: removeTags(ev.summary),
                            location: removeTags(ev.location),
                            description: removeTags(ev.description),
                            start: ev.start
                        }
                        // add the newly created object to an array for use later.
                        eventList.push(eventData);
                    } else {
                        console.log("Undefined event summary. Skipping...");
                    }

                }
            }

            // Check if we have data
            if (eventList.length > 0) {
                
                var filteredEvents;

                // filter events by date if one was provided
                if (dateRange != undefined && dateRange.startDate && dateRange.endDate) {
                    console.log("Looking for events within the date range provided");
                    filteredEvents = getEventsBetweenDates(dateRange.startDate, dateRange.endDate, eventList);
                } else {
                    // if no date was provided, search from now to 10 years from now
                    console.log("No date range provided. Searching from today...");
                    var startDate = new Date();
                    var endDate = new Date();
                    endDate.setDate(startDate.getDate() + 365*10)
                    filteredEvents = getEventsBetweenDates(startDate, endDate, eventList);
                }

                // create a new array with all the events that match the keyword
                relevantEvents = getEventsWithKeyword(keyword, filteredEvents);

               if (relevantEvents.length > 0) {
                    // change state to description
                    parent.handler.state = states.DESCRIPTION;

                    // Create output for both Alexa and the content card
                    var cardContent = "";
                    output = oneEventMessage;
                    if (relevantEvents.length > 1) {
                        output = utils.format(multipleEventMessage, relevantEvents.length);
                    }

                    output += scheduledEventMessage;

                    if (relevantEvents.length > 1) {
                        var numberOfEvents = Math.min(relevantEvents.length,3);
                        output += utils.format(firstThreeMessage, numberOfEvents);
                    }

                    if (relevantEvents[0] != null) {
                        var date = new Date(relevantEvents[0].start);
                        output += utils.format(eventSummary, "First", removeTags(relevantEvents[0].summary), dateStringForResponse(date) + ".");
                    }
                    if (relevantEvents[1]) {
                        var date = new Date(relevantEvents[1].start);
                        output += utils.format(eventSummary, "Second", removeTags(relevantEvents[1].summary), dateStringForResponse(date) + ".");
                    }
                    if (relevantEvents[2]) {
                        var date = new Date(relevantEvents[2].start);
                        output += utils.format(eventSummary, "Third", removeTags(relevantEvents[2].summary), dateStringForResponse(date) + ".");
                    }

                    for (var i = 0; i < relevantEvents.length; i++) {
                        var date = new Date(relevantEvents[i].start);
                        cardContent += utils.format(cardContentSummary, removeTags(relevantEvents[i].summary), dateStringForResponse(date)+ "\n\n");
                    }

                    output += eventNumberMoreInfoText;
                    console.log("Alexa output: " + output);
                    alexa.emit(':askWithCard', output, haveEventsRepromt, cardTitle, cardContent);
                } else {
                    output = NoDataMessage;
                    console.log("Alexa output: " + output);
                    alexa.emit(':ask', output, output);
                }
            } else {
                output = NoDataMessage;
                console.log("Alexa output: " + output);
                alexa.emit(':ask', output, output);
            }
        } else {
            console.log("iCal Error: " + err);
        }
    });
}


//======== HELPER FUNCTIONS ==============

// Remove HTML tags from string
function removeTags(str) {
    if (str != undefined) {
        return str.replace(/<(?:.|\n)*?>/gm, '');
    } else {
        return "";
    }
}

// Given an AMAZON.DATE slot value parse out to usable JavaScript Date object
// Utterances that map to the weekend for a specific week (such as �this weekend�) convert to a date indicating the week number and weekend: 2015-W49-WE.
// Utterances that map to a month, but not a specific day (such as �next month�, or �December�) convert to a date with just the year and month: 2015-12.
// Utterances that map to a year (such as �next year�) convert to a date containing just the year: 2016.
// Utterances that map to a decade convert to a date indicating the decade: 201X.
// Utterances that map to a season (such as �next winter�) convert to a date with the year and a season indicator: winter: WI, spring: SP, summer: SU, fall: FA)
function getDateFromSlot(rawDate) {
    // try to parse data
    var date = new Date(Date.parse(rawDate));
    var result;
    // create an empty object to use later
    var eventDate = {

    };

    // if could not parse data must be one of the other formats
    if (isNaN(date)) {
        // to find out what type of date this is, we can split it and count how many parts we have see comments above.
        var res = rawDate.split("-");

        // if we have 2 bits that include a 'W' week number
        if (res.length === 2 && res[1].indexOf('W') > -1) {
            var dates = getWeekData(res);
            eventDate["startDate"] = new Date(dates.startDate);
            eventDate["endDate"] = new Date(dates.endDate);
            // if we have 3 bits, we could either have a valid date (which would have parsed already) or a weekend
        } else if (res.length === 3) {
            var dates = getWeekendData(res);
            eventDate["startDate"] = new Date(dates.startDate);
            eventDate["endDate"] = new Date(dates.endDate);
            // anything else would be out of range for this skill
        } else {
            eventDate["error"] = dateOutOfRange;
        }
        // original slot value was parsed correctly
    } else {
        // by default, we use the parsed date
        eventDate["startDate"] = new Date(date).setUTCHours(0, 0, 0, 0);
        
        var res = rawDate.split("-");
        // if the date was just a year (e.g. "2017"), change the end date to the end of the year
        if (res.length === 1) {
            eventDate["endDate"] = new Date(date.getFullYear()+1, 1, 1).setUTCHours(24, 0, 0, 0);
        } else if (res.length === 2) {
            // if the date was a month (e.g. "2017-11"), change the end date to the end of the month
            eventDate["endDate"] = new Date(date.getFullYear(), date.getMonth()+1, 0).setUTCHours(24, 0, 0, 0);
        } else {
            // if the date was correctly parsed, set the end date at the end of the day
            eventDate["endDate"] = new Date(date).setUTCHours(24, 0, 0, 0);
        }
    }

    // TODO: convert eventDate['startDate'] and eventDate['endDate'] to the right Pacific time zone times
    eventDate['startDate'] = convertDateFromPSTtoGMT(eventDate['startDate']);
    eventDate['endDate'] = convertDateFromPSTtoGMT(eventDate['endDate']);
    
    console.log("Start time: " + eventDate['startDate']);
    console.log("End time: " + eventDate['endDate']);

    return eventDate;
}


// convert a date that was originally created as a PST date to the right GMT date
function convertDateFromPSTtoGMT(PSTdate) {
    
    var pstDateString = moment(PSTdate).format();    // format will be like "2013-11-18T00:00:00+00:00"
    var pstDateWithoutOffset = pstDateString.substr(0, pstDateString.length-6);
    // console.log("PST date without offset: " + pstDateWithoutOffset);
    
    var gmtDateAsMoment = moment.tz(pstDateWithoutOffset,"America/Los_Angeles");   // will be like "2013-11-18T00:00:00-08:00"
    var gmtDate = gmtDateAsMoment.toDate();
    // console.log("GMT date: " + gmtDate);
    return gmtDate;

    
    // var dateString = moment.tz(pstDateWithoutOffset,"America/Los_Angeles").format();   
    // console.log("dateString: " + dateString);
    // var dateWithoutOffset = dateString.substr(0, dateString.length-6);
    // var gmtDate = moment(dateWithoutOffset).toDate();
    // console.log("GMT date: " + gmtDate);
    // return gmtDate;

    // previous version, which probably doesn't work for daylight savings time
    // var gmtDate = moment(PSTdate).clone().add("8", "hours");
    // return gmtDate.toDate();
}

// convert a date that was originally created as a GMT date to the right PST date
function convertDateFromGMTtoPST(GMTdate) {
    
    var gmtDateString = moment(GMTdate).format();    // format will be like "2013-11-18T00:00:00+00:00"
    var gmtDateWithoutOffset = gmtDateString.substr(0, gmtDateString.length-6);
    
    var pstDateAsMoment = moment.tz(gmtDateWithoutOffset,"America/Los_Angeles");   // will be like "2013-11-18T00:00:00-08:00"
    var pstDate = pstDateAsMoment.toDate();
    return pstDate;
}

// Returns the speech response corresponding to the provided date
function dateStringForResponse(date) {
    if (isFullDayEvent(date)) {
        // full day events are incorrectly entered as GMT times
        var dateString = moment(date).tz("GMT").format("MMMM Do");
    } else {
        // sample format string: 'MMMM Do YYYY, h:mm:ss a' --> December 4th 2016, 8:09:15 pm
        var dateString = moment(date).tz("America/Los_Angeles").format("MMMM Do");
        var pstTimeString = moment(date).tz("America/Los_Angeles").format("h:mm a");
        dateString = dateString + " at " + pstTimeString;
    }

    return dateString;
}

// returns true if the date corresponds to a full-day event
function isFullDayEvent(date) {
    var gmtTimeString = moment(date).format("h:mm a");
    if (gmtTimeString == "12:00 am") {
        return true;
    } else {
        return false;
    }
}



// Given a week number return the dates for both weekend days
function getWeekendData(res) {
    if (res.length === 3) {
        var saturdayIndex = 5;
        var sundayIndex = 6;
        var weekNumber = res[1].substring(1);

        var weekStart = w2date(res[0], weekNumber, saturdayIndex);
        var weekEnd = w2date(res[0], weekNumber, sundayIndex);

        return Dates = {
            startDate: weekStart,
            endDate: weekEnd,
        };
    }
}

// Given a week number return the dates for both the start date and the end date
function getWeekData(res) {
    if (res.length === 2) {

        var mondayIndex = 0;
        var sundayIndex = 6;

        var weekNumber = res[1].substring(1);

        var weekStart = w2date(res[0], weekNumber, mondayIndex);
        var weekEnd = w2date(res[0], weekNumber, sundayIndex);

        return Dates = {
            startDate: weekStart,
            endDate: weekEnd,
        };
    }
}

// Used to work out the dates given week numbers
var w2date = function (year, wn, dayNb) {
    var day = 86400000;

    var j10 = new Date(year, 0, 10, 12, 0, 0),
        j4 = new Date(year, 0, 4, 12, 0, 0),
        mon1 = j4.getTime() - j10.getDay() * day;
    return new Date(mon1 + ((wn - 1) * 7 + dayNb) * day);
};


// Loops though the events from the iCal data, and checks which ones are between our start data and out end date (not including the end date)
function getEventsBetweenDates(startDate, endDate, eventList) {

    var start = new Date(startDate);
    var end = new Date(endDate);

    console.log("Searching for events between " + start.toString() + " and " + end.toString());

    var data = new Array();

    for (var i = 0; i < eventList.length; i++) {
        // full day events are incorrectly listed as starting at 12:00 AM GMT instead of local time
        if (isFullDayEvent(eventList[i].start)) {
            // convert the start time to PST (i.e. 12:00 AM PST) to do the comparison
            var adjustedStart = convertDateFromGMTtoPST(eventList[i].start); 
            if (start <= adjustedStart && end > adjustedStart) {
                data.push(eventList[i]);
            }
        } else {
            // not a full day event, so we can do a simple comparison
            if (start <= eventList[i].start && end > eventList[i].start) {
                data.push(eventList[i]);
            }
        }
    }

    console.log("Found " + data.length + " events between those times")
    return data;
}


// Loops through the events from the iCal data, and returns an array of entries whose summary matches the keyword
function getEventsWithKeyword(keyword, eventList) {

    console.log("Getting events for keyword '" + keyword + "'");
    console.log(eventList.length + " events were provided");
    
    var data = new Array();

    // normalize the keyword -- convert to lowercase and remove an 's' from the end (simple way to make singular)
    var normalizedKeyword = keyword.toLowerCase();
    normalizedKeyword = normalizedKeyword.replace(/s$/, '');

    for (var i = 0; i < eventList.length; i++) {

        var pos = eventList[i].summary.toLowerCase().indexOf(normalizedKeyword);
        if (pos != -1) {
            data.push(eventList[i]);
        }
    }

    console.log("FOUND " + data.length + " events matching keyword '" + keyword + "'");

    return data;
}


