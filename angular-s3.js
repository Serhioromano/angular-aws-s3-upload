(!function() {
	angular.module('angular.aws.s3', []).

		directive('s3', function(S3UploaderSrv, $timeout) {
			function link(scope, element, attrs, ngModel) {

				var input = angular.element('<input type="file">');
				var errors = 0;

				if(scope.options.multiple) {
					input.attr('multiple', 'true');
				}

				input.css({
					opacity: 0,
					position: 'absolute',
					top: 0,
					right: 0,
					width: '100%',
					height: '100%'
				}).bind('change', function(event) {
					var files = event.target.files;

					angular.forEach(files, function(v, k) {

						scope.files.push(v);
					});
					scope.$apply();

					if(scope.options.immediate) {
						scope.upload();
					}
				});

				element.css({
					position: 'relative',
					overflow: 'hidden'
				}).append(input);

				ngModel.$render = function() {
					scope.files = ngModel.$viewValue;
				};

				// Validation
				scope.$watch('files', function(newv, oldv) {
					var uploaded = 0;
					var size = 0;
					errors = 0;

					ngModel.$setValidity('upload', true);

					angular.forEach(newv, function(v, k) {

						v.error = false;

						ngModel.$setValidity('extension', true);
						if(angular.isArray(scope.options.extensions) && scope.options.extensions.length > 0) {
							var ext = v.name.split('.').pop().toLowerCase();
							if(scope.options.extensions.indexOf(ext) == -1) {
								_error('extension', v);
							}
						}

						ngModel.$setValidity('filesize', true);
						if(scope.options.filesize > 0 && scope.options.filesize < v.size) {
							_error('filesize', v);
						}

						if(v.success === true) {
							uploaded++;
						}
						size += v.size;

					});

					if(scope.options.limit > 0 && newv.length > scope.options.limit) {
						_error('totalfiles', newv);
					} else {
						ngModel.$setValidity('totalfiles', true);
					}

					if(scope.options.totalsize > 0 && scope.options.totalsize < size) {
						_error('totalsize', newv);
					} else {
						ngModel.$setValidity('totalsize', true);
					}

					if(attrs.required && uploaded == 0 && errors == 0) {
						_error('required', newv);
					} else {
						ngModel.$setValidity('required', true);
					}
				}, true);

				scope.$on('s3uploader:start', function() {
					scope.upload();
				});

				scope.upload = function() {
					scope.start_upload_state = true;

					ngModel.$setValidity('policy_content', true);
					ngModel.$setValidity('policy_get', true);
					ngModel.$setValidity('policy_set', true);

					if(angular.isObject(scope.options.policy)) {
						_upload();
					} else if(scope.options.policyUrl) {
						$http.get(scope.options.policyUrl).success(function(response, status) {
							if(!angular.isObject(response)) {
								_error('policy_content', response);
								return;
							}
							scope.options.policy = response;
							_upload();
						}).error(function(error, status) {
							_error('policy_get', error);
						});
					} else {
						_error('policy_set', null);
					}
				};

				function _upload() {
					angular.forEach(scope.files, function(v, k) {
						if(!v.lastModified || v.error) {
							return;
						}
						S3UploaderSrv.process(v, k, scope, ngModel).then(function(file) {
							if(angular.isFunction(scope.options.on_success)) {
								scope.options.on_success('File uploaded success', file);
							}
						}, function(xhr) {
							_error('upload', v);
						});
					})
				}

				function _error(name, file) {
					ngModel.$setValidity(name, false);
					if(angular.isFunction(scope.options['on_error_' + name])) {
						scope.options['on_' + name](file);
					}
					if(angular.isFunction(scope.options.on_error)) {
						scope.options.on_error(name, file);
					}
					scope.$emit('s3uploader:error:' + name, file);
					scope.$emit('s3uploader:error', file);
					if(angular.isObject(file)) {
						file.error = true;
					}
					errors++;
				}
			}

			return {
				restrict: 'EA',
				link:     link,
				require:  'ngModel',
				scope:    {
					options: '='
				}
			}
		}).

		factory('S3UploaderSrv', function($q, $timeout) {
			function process(file, $index, scope, ngModel) {
				var defer = $q.defer();

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
				file.percent = 0;
				file.cancel = function() {
					xhr.abort();
					delete file;
				};

				var last_loaded = 0;
				var last_time = new Date().getTime();
				var count = 0;
				var summ = 0;

				function uploadProgress(e) {
					if(e.lengthComputable) {
						var loaded = e.loaded - last_loaded;
						last_loaded = e.loaded;

						var time = new Date().getTime();
						var period = (time - last_time) / 1000;
						last_time = time;

						count++;
						summ += (loaded / period) * 8;

						file.speed = summ / count;

						file.progress = Math.round(e.loaded * 100 / e.total);
					}
					ngModel.$setViewValue(scope.files);
				}

				function uploadComplete(e) {
					var xhr = e.srcElement || e.target;
					if(xhr.status === 204) {
						file.real = 'https://' + scope.options.bucket + '.s3.amazonaws.com/' + key;
						stop(true);
					} else {
						stop(false);
					}
				}

				function uploadFailed(e) {
					stop(false);
				}

				function uploadCanceled(e) {
					stop(false);
				}

				function stop(success) {
					$timeout(function() {
						scope.$apply(function() {
							file.success = success;

							delete file.progress;
							delete file.speed;
							delete file.cancel;
							delete file.upload;
							delete file.webkitRelativePath;
							delete file.lastModifiedDate;
							delete file.lastModified;

							scope.start_upload_state = false;

							if(success) {
								defer.resolve(file);
							} else {
								defer.reject(xhr);
							}
							scope.start_upload_state = false;
						});
					}, 0);
				}

				return defer.promise;
			}

			return {
				process: process
			}
		}).

		directive('s3Upload', function() {
			return {
				restrict: 'EA',
				scope:    {
					's3Upload': '='
				},
				link:     function(scope, el) {

					el.bind('click', function() {
						scope.$parent.$broadcast('s3uploader:start');
					});

					el.css({'visibility': 'hidden'});

					scope.$watch('s3Upload', function(oldv, newv) {
						angular.forEach(scope.s3Upload, function(v, k) {
							if(!v.real) {
								el.css({'visibility': 'visible'});
							}
							return false;
						})
					}, true)
				}
			}
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

		filter('speedsize', function() {
			return function(bytes, precision) {
				if(isNaN(parseFloat(bytes)) || !isFinite(bytes)) return '-';
				if(typeof precision === 'undefined') precision = 1;
				var units = ['Kb/s', 'Kbs/s', 'Mbs/s', 'Gbs/s', 'Tbs/s', 'Pbs/s'],
					number = Math.floor(Math.log(bytes) / Math.log(1024));
				return (bytes / Math.pow(1024, Math.floor(number))).toFixed(precision) + ' ' + units[number];
			}
		});

}());