(defpackage :turtl-gen
  (:use :cl)
  (:export :generate))
(in-package :turtl-gen)

(defparameter *site-assets* "app/"
  "The location of the JS project assets.")

;;; ----------------------------------------------------------------------------
;;; Utils
;;; ----------------------------------------------------------------------------
(defun file-contents (path &optional binaryp)
  "Grab a file's contents, optionally in string form."
  (with-open-file (s path :direction :input :element-type (when binaryp '(unsigned-byte 8)))
    (let* ((num-bytes (file-length s))
           (seq (if binaryp
                    (make-array num-bytes :element-type '(unsigned-byte 8))
                    (make-string num-bytes))))
      (read-sequence seq s)
      seq)))

(defun write-file (path data)
  "Write an output file."
  (with-open-file (s path :direction :output :if-exists :supersede :element-type (if (stringp data) nil '(unsigned-byte 8)))
    (write-sequence data s))
  t)

(defun directory-p (path)
  "Test if the given path is a directory."
  (let ((probe (probe-file path)))
    (when probe
      (not (pathname-name probe)))))

(defun directory-list (path)
  "Get all files in a directory."
  (let* ((path (namestring path))
         (path (if (char= (aref path (1- (length path)))
                          #\/)
                   path
                   (concatenate 'string path "/")))
         (path (if (char= (aref path (1- (length path)))
                          #\*)
                   path
                   (concatenate 'string path "*.*"))))
    (directory path)))

(defun string-replace (source from to &key (start 0))
  "Do a string replacement on source."
  (let ((pos (search from source :start2 start)))
    (if pos
        (let* ((split-1 (subseq source 0 pos))
               (split-2 (subseq source (+ pos (length from))))
               (new (concatenate 'string
                                 split-1
                                 to
                                 split-2)))
          (string-replace new from to :start (+ (length split-1) (length to))))
        source)))

(defun get-files (dir &key (ext ".js") exclude)
  "Recursively grap all files in the given directory, with the given extension,
   excluding the patterns given."
  (unless (directory-p dir)
    (return-from get-files nil))
  (when (and (stringp dir)
             (not (eq (aref dir (1- (length dir))) #\/)))
    (setf dir (format nil "~a/" dir)))
  (let* ((files (directory-list dir))
         (files (mapcar (lambda (file)
                          (if (directory-p file)
                              (namestring file)
                              (let ((ext (pathname-type file)))
                                (concatenate 'string
                                             dir
                                             (pathname-name file)
                                             (when ext (format nil ".~a" ext))))))
                          files))
         (ext-length (length ext))
         (files (remove-if (lambda (file)
                             (and (not (string= (subseq file (- (length file) ext-length))
                                                ext))
                                  (not (directory-p file))))
                           files))
         (files (remove-if (lambda (file)
                             (block do-remove
                               (dolist (ex exclude)
                                 (when (search ex file)
                                   (return-from do-remove t)))))
                           files))
         (final nil))
    (dolist (file files)
      (if (directory-p file)
          (setf final (append final (get-files file :ext ext :exclude exclude)))
          (push file final)))
    (sort final #'string<)))

(defun do-replacements (source replace-list)
  "Given an alist of search -> replace pairs, replace them in the given source."
  (dolist (rep replace-list)
    (let ((search (car rep))
          (replace (cdr rep)))
      (setf source (string-replace source search replace))))
  source)

;;; ----------------------------------------------------------------------------
;;; Builders
;;; ----------------------------------------------------------------------------
(defun make-scripts (stream assets files &key prepend)
  "Given a stream and list of files, print a <script ...></script> tag for each
   file onto the stream."
  (format stream "~%")
  (dolist (file files)
    (let* ((search-pos (search assets file))
           (search-pos (when search-pos
                         (+ (1- (length assets)) search-pos)))
           (search-pos (or search-pos 0))
           (file (subseq file search-pos))
           (file (concatenate 'string prepend file)))
      (format stream "<script src=\"~a\"></script>~%" file))))

(defun make-css (stream assets files &key prepend)
  "Given a stream and list of files, print a <link ...> css tag for each
   file on the stream."
  (format stream "~%")
  (dolist (file files)
    (let* ((search-pos (search assets file))
           (search-pos (when search-pos
                         (+ (1- (length assets)) search-pos)))
           (search-pos (or search-pos 0))
           (file (subseq file search-pos))
           (file (concatenate 'string prepend file)))
      (format stream "<link rel=\"stylesheet\" href=\"~a\">~%" file))))

(defun generate-templates (stream view-dir)
  "Make a bunch of pre-cached javascript templates as <script> tags."
  (format stream "~%")
  (let ((files (get-files view-dir :ext ".html")))
    (dolist (file files)
      (let* ((contents (file-contents file))
             (contents (string-replace contents "</script>" "</%script%>"))
             (contents (string-replace contents "<script" "<%script%"))
             (name (subseq file (1+ (length view-dir))))
             (name (subseq name 0 (position #\. name :from-end t))))
        (format stream "<script type=\"text/x-lb-tpl\" name=\"~a\">~%" name)
        (write-string contents stream)
        (format stream "</script>~%")))))

;;; ----------------------------------------------------------------------------
;;; Main
;;; ----------------------------------------------------------------------------
(defun generate (assets output-type &key (prepend ""))
  (let* ((assets (namestring (car (directory assets))))
         (css (with-output-to-string (s)
                (make-css s assets
                          (get-files assets
                                     :ext ".css"
                                     :exclude '("template.css"
                                                "reset.css"
                                                "general.css"))
                          :prepend prepend)))
         (js (with-output-to-string (s)
               (make-scripts s assets
                             (get-files (format nil "~alibrary" assets)
                                        :ext ".js"
                                        :exclude '("ignore"
                                                   "mootools-"
                                                   "composer"
                                                   "bookmarklet"
                                                   "mathjax"))
                             :prepend prepend)
               (make-scripts s assets (list (format nil "~a/turtl.js" prepend)))
               (make-scripts s assets (get-files (format nil "~aturtl" assets)) :prepend prepend)
               (make-scripts s assets (get-files (format nil "~ahandlers" assets)) :prepend prepend)
               (make-scripts s assets (get-files (format nil "~acontrollers" assets)) :prepend prepend)
               (make-scripts s assets (get-files (format nil "~amodels" assets)) :prepend prepend)))
         (tpl (with-output-to-string (s)
                (generate-templates s (format nil "~aviews" (namestring assets)))))
         (replacements `(("{{gencss}}" . ,css)
                         ("{{genjs}}" . ,js)
                         ("{{gentpl}}" . ,tpl))))
    (case output-type
      (:index
        (let ((data (file-contents "chrome/content/data/index.html.tpl")))
          (write-file "chrome/content/data/index.html" (do-replacements data replacements))))
      (:popup
        (let ((data (file-contents "chrome/content/data/popup/index.html.tpl")))
          (write-file "chrome/content/data/popup/index.html" (do-replacements data replacements))))
      (:index-popup
        (let ((idx (file-contents "chrome/content/data/index.html.tpl"))
              (pop (file-contents "chrome/content/data/popup/index.html.tpl")))
          (write-file "chrome/content/data/index.html" (do-replacements idx replacements))
          (write-file "chrome/content/data/popup/index.html" (do-replacements pop replacements))))
      (:string
        (let ((data (file-contents "data/index.html.tpl")))
          (do-replacements data replacements))))))

