const async = require('async');
const rp = require('request-promise');
const colors = require('./../colors');
const Comment = require('./../db').models.Comment;
const commentController = require('./../controllers/commentController');
const config = require('./../../config');
const parseJSON = require('../requestHelpers').parseJSON;

const commentCreationQ = async.queue((commentId, callback) => {
  Comment.find({
    where: {
      id: commentId,
    },
  })
  .then((foundCommentRecord) => {
    if (foundCommentRecord) {
      const aproxQLength = commentCreationQ.length() + config.asyncWorkers.commentCreationQ;
      console.log(colors.verbose(`Comment | Already Exists ${commentId} (<${aproxQLength} left)`));
      return callback();
    }

    return rp(`https://hacker-news.firebaseio.com/v0/item/${commentId}.json`)
      .then(parseJSON)
      .then((comment) => {
        if ({}.hasOwnProperty.call(comment, 'deleted')) {
          throw new Error('Comment has been deleted.');
        }

        return commentController.create(comment);
      })
      .then(() => {
        const aproxQLength = commentCreationQ.length() + config.asyncWorkers.commentCreationQ;
        console.log(colors.verbose(`Comment | Saved ${commentId} (<${aproxQLength} left)`));
        callback();
      })
      .catch((err) => {
        callback(err);
      });
  })
  .catch((err) => {
    callback(err);
  });
}, config.asyncWorkers.commentCreationQ);

commentCreationQ.drain = () => {
  console.log(colors.success('Saved all Comments'));
};

module.exports = commentCreationQ;
