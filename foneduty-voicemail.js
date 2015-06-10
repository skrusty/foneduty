// FoneDuty-Voicemail Zapappi Application
// Copyright Ben Merrills - 2015, http://www.xdev.net
// License: MIT, See 

// Description
// This Zapappi ZapApp lets you accept an incoming call, take a recording
// (like a voicemail) and then create an incident from that voicemail.
// I created this application to do oncall engineer style voicemail request.
//
// You'll need an account on Zapappi to use this application. You can create a free
// one by visiting: https://portal.zappapi.com and registering.
//
// This application requires you have an AWS S3 account where
// the voicemail recording can be stored.
// You'll need to populate the following Key Value Pairs in your app's
// configuration screen.
//
// Bucket: the AWS bucker you want to store the recording in
// Key: Your AWS key (make one specific to this task!)
// Secret: The secret that goes with the Key you're using
// Folder: The folder (virtual) that you want to store your recording in
// AWSRegion: The region your S3 bucket exists in
// PagerDutyServiceToken: The token for the pager duty service this alert belongs to
// PagerDutyKey: Your API key for Pager Duty

call.Answer();

call.Say("You've reached the emergency out of hours engineer line.");
call.Say("Please leave your name, company name, contact telephone number and a brief description of the issue after the tone.");
call.Say("When done, hangup and an engineer will be in touch shortly.");

var callerNumber = req.FromUri.User;

// Record the message from the caller
var recording = call.Record({
	EscapeKey: "#",
    Format: "wav",
    Timeout: 90,
    MaxSilence: 5,
    Beep: true
});

sys.Log("Uploading to AWS");
// Upload the file to AWS
ext.AWS.UploadToBucket(recording.Filename, 
	config.GetKeyValue("Bucket"), 
	config.GetKeyValue("Key"), 
	config.GetKeyValue("Secret"), 
	config.GetKeyValue("Folder"), 
	config.GetKeyValue("AWSRegion"), 
	"audio/x-wav", 
	recording.Filename);

var awsUrl = "https://s3-" 
	+ config.GetKeyValue("AWSRegion") 
	+ ".amazonaws.com/" 
	+ config.GetKeyValue("Bucket") 
	+ "/" + config.GetKeyValue("Folder") 
	+ "/" + recording.Filename; 
	
sys.Log("AWS Url: " + awsUrl);
	
// Create an alert in pager duty
var trigger = {
	service_key: config.GetKeyValue("PagerDutyServiceToken"),
	event_type: "trigger",
	description: "A new oncall voicemail has been left by a customer calling from " + callerNumber,
	client: "Zapappi Pager Duty Sample",
	client_url: "http://www.zapappi.com",
	details: {
		voicemail: awsUrl,
		callerid: callerNumber,
		calldatetime:  new Date().toUTCString()
	}
};

// Stringify and POST to PagerDuty API
var triggerString = JSON.stringify(trigger);
sys.Log(triggerString);
var response = sys.Web("https://events.pagerduty.com/generic/2010-04-15/create_event.json?token=" + config.GetKeyValue("PagerDutyKey"), "POST", {
	Body: triggerString
});
