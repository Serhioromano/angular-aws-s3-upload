(!function() {
	angular.module('angular.aws.s3', []).

		directive('s3Input', function($filter) {
			return {
				restrict: 'AE',
				require: '^ngModel',
				link:     function(scope, el, attrs, ngModel) {
					if(scope.options.multiple) {
						el.attr('multiple', 'true');
					}
					el.bind('change', function(event) {
						var files = event.target.files;
						angular.forEach(files, function(v, k) {
							console.log(v);
							if(angular.isArray(scope.options.extensions) && scope.options.extensions.length > 0) {
								var ext = v.name.split('.').pop().toLowerCase();
								if(scope.options.extensions.indexOf(ext) == -1) {
									if(angular.isFunction(scope.options.cb_error)) {
										scope.options.cb_error('Unhallowed file extension: '+ ext);
									}
									return true;
								}
							}
							if(scope.options.filesize > 0 && scope.options.filesize < v.size) {
								if(angular.isFunction(scope.options.cb_error)) {
									scope.options.cb_error('File size bigger than allowed: ' + $filter('filesize')(scope.options.filesize));
								}
								return true;
							}
							if(scope.options.limit > 0 && scope.files.length >= scope.options.limit) {
								// todo replace file.
								if(angular.isFunction(scope.options.cb_error)) {
									scope.options.cb_error('You have reached maximum amount of files to upload: ' + scope.options.limit);
								}
								return;
							}

							scope.files.push(v);
						});
						scope.$apply();

						if(scope.options.immediate) {
							scope.upload();
						}
					});
				}
			};
		}).

		filter('filesize', function() {
			return function(bytes, precision) {
				if(isNaN(parseFloat(bytes)) || !isFinite(bytes)) return '-';
				if(typeof precision === 'undefined') precision = 1;
				var units = ['bytes', 'kB', 'MB', 'GB', 'TB', 'PB'],
					number = Math.floor(Math.log(bytes) / Math.log(1024));
				return (bytes / Math.pow(1024, Math.floor(number))).toFixed(precision) + ' ' + units[number];
			}
		}).

		directive('s3', function(S3UploaderSrv) {
			function link(scope, element, attrs, ngModel) {

				ngModel.$render = function () {
					scope.files = ngModel.$viewValue;
				};

				ngModel.$setValidity('upload', false);
				ngModel.$render();

				scope.upload = function() {
					scope.start_upload_state = true;
					if(scope.options.policyUrl) {
						$http.get(scope.options.policyUrl).success(function(response, status) {
							if(!angular.isObject(response)) {
								if(angular.isFunction(scope.options.cb_error)) {
									scope.options.cb_error('Service returned not a polilcy');
								}
								return;
							}
							scope.options.policy = response;
							_upload();
						}).error(function(error, status) {
							if(angular.isFunction(scope.options.cb_error)) {
								scope.options.cb_error('Could not get a policy');
							}
						});
					} else if(angular.isObject(scope.options.policy)) {
						_upload();
					} else {
						if(angular.isFunction(scope.options.cb_error)) {
							scope.options.cb_error('No policy parameter');
						}
					}
				};

				function _upload() {
					angular.forEach(scope.files, function(v, k) {
						S3UploaderSrv.process(v, k, scope);
					})
				}
			}

			return {
				restrict:    'EA',
				templateUrl: 'uploader.html',
				link:        link,
				require:     'ngModel',
				scope:       {
					options: '='
				}
			}
		}).

		factory('S3UploaderSrv', function($http, $q) {
			function process(file, $index, scope) {

				if(file.progress == 100) {
					return;
				}

				var ext = file.name.split('.').pop().toLowerCase();
				var key = scope.options.folder || '';
				if(scope.options.filename) {
					key += scope.options.filename + '.' + ext;
				} else {
					key += file.name.replace(' ', '-');
				}

				var fd = new FormData();
				fd.append('key', key);
				fd.append('acl', scope.options.acl || 'public-read');
				fd.append('Content-Type', file.type);
				fd.append('AWSAccessKeyId', scope.options.policy.key);
				fd.append('policy', scope.options.policy.policy);
				fd.append('signature', scope.options.policy.signature);
				fd.append("file", file);

				var xhr = new XMLHttpRequest();
				xhr.upload.addEventListener("progress", uploadProgress, false);
				xhr.addEventListener("load", uploadComplete, false);
				xhr.addEventListener("error", uploadFailed, false);
				xhr.addEventListener("abort", uploadCanceled, false);

				xhr.open('POST', 'https://' + scope.options.bucket + '.s3.amazonaws.com/', true);
				xhr.send(fd);

				file.upload = true;
				file.progress = false;
				file.progress = 1;

				function uploadProgress(e) {
					scope.$apply(function() {
						if(e.lengthComputable) {
							file.progress = Math.round(e.loaded * 100 / e.total);
						}
					});
				}

				function uploadComplete(e) {
					file.upload = false;
					var xhr = e.srcElement || e.target;
					if(xhr.status === 204) {
						file.success = true;
					} else {
						file.success = false;
					}
					delete file.progress;
					delete file.upload;
					delete file.webkitRelativePath;
					delete file.lastModifiedDate;
					delete file.lastModified;
					file.real = 'https://' + scope.options.bucket + '.s3.amazonaws.com/' + key;
					scope.start_upload_state = false;
					scope.$apply();
				}

				function uploadFailed(e) {
					file.upload = false;
					file.success = false;
					scope.start_upload_state = false;
					scope.$apply();
				}

				function uploadCanceled(e) {
					file.upload = false;
					file.success = false;
					scope.start_upload_state = false;
					scope.$apply();
				}
			}

			return {
				process: process
			}
		})
}());