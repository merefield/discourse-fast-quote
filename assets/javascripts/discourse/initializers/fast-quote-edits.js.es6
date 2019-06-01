import { withPluginApi } from 'discourse/lib/plugin-api';
import { default as computed, on, observes } from 'ember-addons/ember-computed-decorators';
import Composer from "discourse/models/composer";
import Quote from "discourse/lib/quote";

export default {
  name: 'fast-quote-edits',
  initialize(container){

    if (!Discourse.SiteSettings.fast_quote_enabled) return;

    withPluginApi('0.8.12', (api) => {

        api.modifyClass('controller:topic', {
        actions: {
          // Post related methods
          replyToPost(post) {
            const composerController = this.composer;
            const topic = post ? post.get("topic") : this.model;
            const quoteState = this.quoteState;
            const postStream = this.get("model.postStream");

            if (!postStream || !topic || !topic.get("details.can_create_post")) {
              return;
            }

            var quotedText = "";

            if ((quoteState.buffer == "") || (quoteState.buffer == undefined)) {
               quotedText = Quote.build(post, post.cooked);
            }
            else
            {
              const quotedPost = postStream.findLoadedPost(quoteState.postId);
              quotedText = Quote.build(quotedPost, quoteState.buffer);
            };

            quoteState.clear();

            if (
              composerController.get("model.topic.id") === topic.get("id") &&
              composerController.get("model.action") === Composer.REPLY
            ) {
              composerController.set("model.post", post);
              composerController.set("model.composeState", Composer.OPEN);
              this.appEvents.trigger("composer:insert-block", quotedText.trim());
            } else {
              const opts = {
                action: Composer.REPLY,
                draftKey: topic.get("draft_key"),
                draftSequence: topic.get("draft_sequence")
              };

              if (quotedText) {
                opts.quote = quotedText;
              }

              if (post && post.get("post_number") !== 1) {
                opts.post = post;
              } else {
                opts.topic = topic;
              }

              composerController.open(opts);
            }
            return false;
          }
        }
      })
    })
  }
}
