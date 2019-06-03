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
              if (post) {
               if (((topic.highest_post_number + 1) - (post.post_number)) > Discourse.SiteSettings.fast_quote_post_location_threshold) {
                 quotedText = Quote.build(post, post.cooked);
                 if (Discourse.SiteSettings.fast_quote_remove_prior_quotes) {
                   quotedText = quotedText.replace(/<aside[\s\S]*<\/aside>/g, '');
                 };
                 if (Discourse.SiteSettings.fast_quote_remove_links) {
                   quotedText = quotedText.replace(/<a[\s\S]*<\/a>/g, '');
                 };
                 const startOfQuoteText = quotedText.indexOf("]") + 2; // not forgetting the new line char
                 const lengthOfEndQuoteTag = 11 // [/quote] and newline preceeding
                 var startOfExcerpt = startOfQuoteText;
                 var excerpt = "";
                 if (Discourse.SiteSettings.fast_quote_remove_contiguous_new_lines) {
                   excerpt = quotedText.substring(startOfExcerpt, quotedText.length - lengthOfEndQuoteTag)
                   excerpt = excerpt.replace(/\n*\n/g, '');
                   quotedText = quotedText.substring(0,startOfQuoteText) + excerpt + quotedText.substring(quotedText.length - lengthOfEndQuoteTag, quotedText.length);
                 };
                 if (Discourse.SiteSettings.fast_quote_character_limit) {
                   if (quotedText.length > Discourse.SiteSettings.fast_quote_character_limit) {
                     quotedText = quotedText.replace(/<[^>]*>/g, ''); // remove tags because you are splitting text so can't guarantee where
                     startOfExcerpt = ((quotedText.length-lengthOfEndQuoteTag-Discourse.SiteSettings.fast_quote_character_limit) < startOfQuoteText) ? startOfQuoteText : quotedText.length-Discourse.SiteSettings.fast_quote_character_limit-lengthOfEndQuoteTag-2;
                     quotedText = quotedText.substring(0,startOfQuoteText) + quotedText.substring(startOfExcerpt, quotedText.length);
                   }
                 };
               }
              }
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
