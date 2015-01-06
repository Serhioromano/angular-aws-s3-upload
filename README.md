# Angular AWS S3 Uploader

It is hard to setup a demo for AWS S3 upload. First it will trash my bucket and I have to support Web server which gives you policies. So I created small [demo video](http://youtu.be/vqAgCY1XE8o).

### Why?

I did not find anything I really like. What I needed from such a module is.

1. Lightweight.
2. Independence of any other 3d party libraries.
3. Complete control over how it looks and works. In one case I just need a button to upload avatar, or sometimes a series of videos.
4. Control over error handling.


## How?

### Install

Install with bower.

    bower install angular-aws-s3-uploader --save

Or download. All you need is only angular dependency

```js
<script type="text/javascript" src="bower_components/angular/angular.js"></script>
<script type="text/javascript" src="bower_components/angular-aws-s3-uploader/angular-s3.js"></script>
```

If you want to use `ngMessages` with this element you have to add this to your project.

And add dependency to your application.

```js
var app = angular.module('myapp', ['angular.aws.s3'])
```

That is it. You are good to start create your interface.

### Concept

This module created such a away that you fully control how your uploader looks. It is rather small framework with AWS s3 tools than ready to use component.

Ready to use components are nice until you what to change something. Directive templates become a real pain for me. yes I can always change template and template path, but I could not find a directive where I can do that and still safely update module without loosing changes.

This is not the case in **Angular AWS S3 Uploader**. It not only have no template file, it does not have even template parameter. It means that HTML elements, their classes and positions are fully up to you. This directive is a helper and you are the UI master.

### Configuring

The main component of this uploader is a button. 

```html
<button class="btn btn-default" s3 options="options" name="uploads" ng-model="form.files" required>
    Select File
</button>
```

You see, you can use button or link or anything else. You set label and classes.

- First is `s3` directive with makes all the magic.
- Then `name` attribute if you want use `ngMessages`.
- `required` attribute is also for using with `ngMessages`.
- You all know `ng-model` right?
- And `options` are described later.

Now you have to add interface as you like. If you use multiple upload you can list `form.files` with `ng-repeat` in a table below, or just show confirmation alert. Thanks to Angular 2 way binding, what ever is added to `form.files` will be available outside directive.

One important thing to know is `upload` button. If your component is not for immediate upload, then you can place another button.

```html
<button class="pull-right btn btn-primary" s3-upload="form.files" ng-disabled="start_upload_state">
	Start Upload
</button>
```

all you have to do is to add `s3-upload="form.files"` directive and when you click this button all attached files will start upload. This button will be also automatically hidden or visible, enabled or disabled depending on conditions.

#### Options

Uploader gives you very wide variety of options to set. Options is an object. So you may insert it directly.

    options="{limit:1}"

or use scope 

    options="options"
    
    $scope.options = {
        limit: 1,
        immediate: true
    }

Here is the list of all options.

Options | Type | Description
---|---|---
multiple | boolean | Allow multiple select files in file dialog.
extensions | array | Allowed extensions `['png', 'jpg', 'mp4']`.
immediate | boolean | Start upload immediately or when user click upload button.
bucket | string | Name of S3 bucket.
acl |  string | What acl rules apply to file after upload. Eg: 'public-read'.
folder | string | Directory in the bucket where file have to be saved.
filename | string | Override file name. This option is useful only if you have single file upload. For example user upload avatar and you upload it to `/avatars/[USR_ID]/avatar.png`. So it is always the same name and this way you always know path to user avatar. It also helps to avoid file management. If user change avatar you do not eed to think to remove old one. Because it will simply override.
filesize | num | Number in bytes maximum allowed size per user.
totalsize | num | Number in bytes maximum allowed size for list of files.
region | string | AWS S3 region: 'us-east-1'.
limit | num | Number of files to uplaod. 0 is unlimited.
on_success | function | callback on success file upload.
replace | boolean | Only works with `limit` set to 1. In this case on new selection it will simply override existing file.
policy | object | AWS policy object. Explained later.
policyUrl | string | URL to get policy object.

#### Policy

We need either policy object or url which will provide this object. The object have to contain 3 keys.

- `key` - The Access Key Identifier credential for your Amazon Web Service account.
- `policy` - A Base64-encoded policy document that applies rules to file uploads sent by the S3 POST form. This document is used to authorize the form, and to impose conditions on the files that can be uploaded. Policy documents will be described in more detail below.
- `signature` - A signature value that authorizes the form and proves that only you could have created it. This value is calculated by signing the Base64-encoded policy document with your AWS Secret Key, a process that I will demonstrate below.

Here is the example how it might looks

```json
{
    "policy":"eyJleHBpcmF0aW9uIjoiMjAxNi0wNS0xOVQwNTozMDow...l1dfQ==",
    "signature":"b0Dd58rD+uDtf2wkALm7+Y2JJG4=",
    "key":"AKIAIBUOK6TJJUEDWPBA"
}
```

Here is the article you could read on how to generate one.

https://aws.amazon.com/articles/1434

I also include `policy.php` file in the project as example how to generate a policy.

#### AWS Config

Another important thing is to configure your S3 bucket permissions. You have to enable CORS on your bucket. here is how you can do that.

http://docs.aws.amazon.com/AmazonS3/latest/dev/cors.html

Long story sort, you have to add to your CORS rules

```xml
<CORSConfiguration>
 <CORSRule>
   <AllowedOrigin>http://www.example1.com</AllowedOrigin>

   <AllowedMethod>PUT</AllowedMethod>
   <AllowedMethod>POST</AllowedMethod>
   <AllowedMethod>DELETE</AllowedMethod>

   <AllowedHeader>*</AllowedHeader>
 </CORSRule>
 <CORSRule>
   <AllowedOrigin>*</AllowedOrigin>
   <AllowedMethod>GET</AllowedMethod>
 </CORSRule>
</CORSConfiguration>
```

You also have to allow your s3 user to upload documents to s3. 



### Error handling

There are 9 errors types.

Error | Description
---|---
`totalsize` | When total size of all files exceed parameter in options
`totalfiles` | When total number of files is more then set in options.
`required` | When you have `required` attribute and none of the files uploaded
`extension` | When one of the files is wrong extension then extensions allowed in options.
`filesize` | When one of the files exceed size per file option
`policy_content` | When we get policy from url but it is not an object
`policy_get` | Error accessing policy URL
`policy_set` | There is no pillory parameter at all
`upload` | Some error during upload. Usually S3 access error will sendup here


Now as you know the names, you can handle errors 3 different ways.

#### ngMessages 

Of course you have to include `ngMessages` module to your file and add dependency. ngMessages is not included in AngularJS and shipped separately.

First you have to add `name` attribute to the same element where you added `s3` directive. Let's assume you have form name `testForm` and uploader name `uploads`, then you might end up with something like this.

```html
<div ng-messages="testForm.uploads.$error">
	<div ng-message="totalsize" class="alert-danger alert">Total size of files is too big.</div>
	<div ng-message="totalfiles" class="alert-danger alert">Total number of files is more than allowed, please delete some of them.</div>
	<div ng-message="required" class="alert-danger alert">At least one file have to be uploaded.</div>
	<div ng-message="extension" class="alert-danger alert">At least one file have to be uploaded.</div>
	<div ng-message="filesize" class="alert-danger alert">One of the files exceed allowed size.</div>
	<div ng-message="policy_content" class="alert-danger alert">URL provides not a policy.</div>
	<div ng-message="policy_get" class="alert-danger alert">Cannot get policy over URL provided.</div>
	<div ng-message="policy_set" class="alert-danger alert">No policy parameter found.</div>
	<div ng-message="upload" class="alert-danger alert">Something happened during uplaod.</div>
</div>
```

#### Callbacks

You may set callbacks in `options`. The name of the callback is `on_` and then name of the error.

```js
$scope.options = {
    on_totalsize: function(files) {}
}
```

There is one general callback for all errors `on_error` if you what to have one method for all errors.

#### Events

S3 uploader will `$emmit` error events. The event name is `s3uploader:error:` and then name. So in your code.

```js
$scope.$on('s3uploader:error:filesize', function(e, file){})
```

There is also one event for all errors if you what to handle all errors in one event `s3uploader:error`.