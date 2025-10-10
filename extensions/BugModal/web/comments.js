/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0. */

$(function() {
    'use strict';

    // comment collapse/expand

    const update_spinner = (spinner, expanded) => {
        const str = spinner.data('strings');

        spinner.attr({
            'aria-label': expanded ? str.collapse_label : str.expand_label,
            'aria-expanded': expanded,
        });
    };

    function toggleChange(spinner, forced) {
        var spinnerID = spinner.attr('id');
        var id = spinnerID.substring(spinnerID.indexOf('-') + 1);

        // non-comment toggle
        if (spinnerID.substr(0, 1) == 'a') {
            var changeSet = spinner.parents('.change-set');
            if (forced == 'hide') {
                changeSet.find('.activity').hide();
                $('#ar-' + id).hide();
                update_spinner(spinner, false);
            }
            else if (forced == 'show' || forced == 'reset') {
                changeSet.find('.activity').show();
                $('#ar-' + id).show();
                update_spinner(spinner, true);
            }
            else {
                changeSet.find('.activity').slideToggle('fast', function() {
                    $('#ar-' + id).toggle();
                    if (changeSet.find('.activity' + ':visible').length) {
                        update_spinner(spinner, true);
                    }
                    else {
                        update_spinner(spinner, false);
                    }
                });
            }
            return;
        }

        // find the "real spinner", which is the one on the non-default-collapsed block
        var realSpinner = $('#cs-' + id);
        var defaultCollapsed = realSpinner.data('ch');
        if (defaultCollapsed === undefined) {
            defaultCollapsed = spinner.attr('id').substring(0, 4) === 'ccs-';
            realSpinner.data('ch', defaultCollapsed);
        }
        if (forced === 'reset') {
            forced = defaultCollapsed ? 'hide' : 'show';
        }

        // comment toggle
        if (forced === 'hide') {
            if (defaultCollapsed) {
                $('#ch-' + id).hide();
                $('#cc-' + id).show();
            }
            $(`#ct-${id}, #cr-${id}, #cre-${id}, #ctag-${id}`).hide();
            $(`#c${id}`).find('.activity, .attachment').hide();
            update_spinner(realSpinner, false);
        }
        else if (forced == 'show') {
            if (defaultCollapsed) {
                $('#cc-' + id).hide();
                $('#ch-' + id).show();
            }
            $(`#ct-${id}, #cr-${id}, #cre-${id}, #ctag-${id}`).show();
            $(`#c${id}`).find('.activity, .attachment').show();
            update_spinner(realSpinner, true);
        }
        else {
            $(`#ct-${id}, #cre-${id}, #c${id} .attachment`).slideToggle('fast').promise().done(() => {
                $('#c' + id).find('.activity').toggle();
                if ($('#ct-' + id + ':visible').length) {
                    $(`#cr-${id}, #ctag-${id}`).show();
                    update_spinner(realSpinner, true);
                    if (defaultCollapsed) {
                        $('#cc-' + id).hide();
                        $('#ch-' + id).show();
                    }
                }
                else {
                    $(`#cr-${id}, #ctag-${id}`).hide();
                    update_spinner(realSpinner, false);
                    if (defaultCollapsed) {
                        $('#ch-' + id).hide();
                        $('#cc-' + id).show();
                    }
                }
            });
        }
    }

    $('.change-spinner')
        .click(function(event) {
            event.preventDefault();
            toggleChange($(this));
        });

    // view and tag menus

    $('#view-reset')
        .click(function() {
            $('.change-spinner:visible').each(function() {
                toggleChange($(this), 'reset');
            });
        });

    $('#view-collapse-all')
        .click(function() {
            $('.change-spinner:visible').each(function() {
                toggleChange($(this), 'hide');
            });
        });

    $('#view-expand-all')
        .click(function() {
            $('.change-spinner:visible').each(function() {
                toggleChange($(this), 'show');
            });
        });

    $('#view-comments-only')
        .click(function() {
            $('.change-spinner:visible').each(function() {
                toggleChange($(this), this.id.substr(0, 3) === 'cs-' ? 'show' : 'hide');
            });
        });

    $('#view-toggle-treeherder')
        .click(function() {
            var that = $(this);
            var userids = that.data('userids');
            if (that.data('hidden') === '0') {
                that.data('hidden', '1');
                that.text('Show Treeherder Comments');
                userids.forEach((id) => {
                    $('.ca-' + id).each(function() {
                        toggleChange($(this).find('.default-collapsed .change-spinner').first(), 'hide');
                    });
                });
            }
            else {
                that.data('hidden', '0');
                that.text('Hide Treeherder Comments');
                userids.forEach((id) => {
                    $('.ca-' + id).each(function() {
                        toggleChange($(this).find('.default-collapsed .change-spinner').first(), 'show');
                    });
                });
            }
        });

    function updateTagsMenu() {
        var tags = [];
        $('.comment-tags').each(function() {
            $.each(tagsFromDom($(this)), function() {
                var tag = this.toLowerCase();
                if (tag in tags) {
                    tags[tag]++;
                }
                else {
                    tags[tag] = 1;
                }
            });
        });
        var tagNames = Object.keys(tags);
        tagNames.sort();

        var btn = $('#comment-tags-btn');
        if (tagNames.length === 0) {
            btn.hide();
            return;
        }
        btn.show();

        // clear out old li items. Always leave the first one (Reset)
        var $li = $('#comment-tags-menu li');
        for (var i = 1, l = $li.length; i < l; i++) {
            $li.eq(i).remove();
        }

        // add new li items
        $.each(tagNames, function(key, value) {
            $('#comment-tags-menu')
                .append($('<li role="presentation">')
                    .append($('<a role="menuitem" tabindex="-1" data-comment-tag="' + value + '">')
                        .append(value + ' (' + tags[value] + ')')));
        });

        $('a[data-comment-tag]').each(function() {
            $(this).click(function() {
                var $that = $(this);
                var tag = $that.data('comment-tag');
                if (tag === '') {
                    $('.change-spinner:visible').each(function() {
                        toggleChange($(this), 'reset');
                    });
                    return;
                }
                var firstComment = false;
                $('.change-spinner:visible').each(function() {
                    var $that = $(this);
                    var commentTags = tagsFromDom($that.parents('.comment').find('.comment-tags'));
                    var hasTag = $.inArrayIn(tag, commentTags) >= 0;
                    toggleChange($that, hasTag ? 'show' : 'hide');
                    if (hasTag && !firstComment) {
                        firstComment = $that;
                    }
                });
                if (firstComment)
                    $.scrollTo(firstComment);
            });
        });
    }

    //
    // anything after this point is only executed for logged in users
    //

    if (BUGZILLA.user.id === 0) return;

    // comment tagging

    function taggingError(commentNo, message) {
        $('#ctag-' + commentNo + ' .comment-tags').append($('#ctag-error'));
        $('#ctag-error-message').text(message);
        $('#ctag-error').show();
    }

    async function deleteTag(event) {
        event.preventDefault();
        $('#ctag-error').hide();

        var that = $(this);
        var comment = that.parents('.comment');
        var commentNo = comment.data('no');
        var commentID = comment.data('id');
        var tagNode = that.parent('.comment-tag');
        var deleteTag = tagNode.data('tag');

        // update ui
        tagNode.remove();
        updateTagsMenu();

        // update Bugzilla
        try {
            var result = await Bugzilla.API.put(
              `bug_modal/update_comment_tags/${commentID}`,
              { remove: [deleteTag] }
            );
            renderTags(commentNo, result.html);
            updateTagsMenu();
        } catch ({ message }) {
            taggingError(commentNo, message);
        }
    }
    $('.comment-tag a.remove').click(deleteTag);

    function tagsFromDom(commentTagsDiv) {
        return commentTagsDiv
            .find('.comment-tag')
            .map(function() {return $(this).data('tag');})
            .toArray();
    }

    function renderTags(commentNo, html) {
        cancelRefresh();
        var root = $('#ctag-' + commentNo + ' .comment-tags');
        root.find('.comment-tag').remove();
        root.append($(html));
        root.find('.comment-tag .remove').click(deleteTag);
        $('#ctag-' + commentNo + ' .comment-tags').append($('#ctag-error'));
    }

    let abort_controller;

    const refreshTags = async (commentNo, commentID) => {
        cancelRefresh();

        try {
            abort_controller = new AbortController();

            const { signal } = abort_controller;
            var result = await Bugzilla.API.get(
                `bug_modal/comment_tags/${commentID}`,
                {}, { signal }
            );
            renderTags(commentNo, result.html);
        } catch ({ name, message }) {
            if (name !== 'AbortError') {
                taggingError(commentNo, message);
            }
        } finally {
            abort_controller = undefined;
        }
    }

    function cancelRefresh() {
        if (abort_controller) {
            abort_controller.abort();
            abort_controller = undefined;
        }
    }

    const saveTag = async () => {
        hideTaggingUI();
        $('#ctag-error').hide();

        const $comment = $('#ctag').parents('.comment');
        const commentNo = $comment.data('no');
        const commentID = $comment.data('id');
        const newTags = $('#ctag-add').val().trim().split(/[ ,]/);
        const { min_comment_tag_length: min, max_comment_tag_length: max } = BUGZILLA.constant;

        if (!newTags.length) {
            return;
        }

        // validate
        try {
            newTags.forEach(tag => {
                if (tag.length < min) {
                    throw `Comment tags must be at least ${min} characters.`;
                }
                if (tag.length > max) {
                    throw `Comment tags cannot be longer than ${max} characters.`;
                }
            });
        } catch(ex) {
            taggingError(commentNo, ex);
            return;
        }

        // update Bugzilla
        try {
            var result = await Bugzilla.API.put(
              `bug_modal/update_comment_tags/${commentID}`,
              { add: newTags }
            );
            renderTags(commentNo, result.html);
            updateTagsMenu();
        } catch ({ message }) {
            taggingError(commentNo, message);
            refreshTags(commentNo, commentID);
        }
    };

    const hideTaggingUI = () => {
        $('#ctag').hide().data('commentNo', '');
    };

    /**
     * Initialize emoji comment reactions.
     */
    const initReactions = () => {
        document.querySelectorAll('.comment-reactions').forEach((/** @type {HTMLElement} */ $wrapper) => {
            new Bugzilla.BugModal.CommentReactions($wrapper);
        });
    };

    $('#ctag-add')
        .devbridgeAutocomplete({
            appendTo: $('#main-inner'),
            forceFixPosition: true,
            deferRequestBy: 250,
            minChars: 3,
            tabDisabled: true,
            autoSelectFirst: true,
            triggerSelectOnValidInput: false,
            lookup: (query, done) => {
                // Note: `async` doesn't work for this `lookup` function, so use a `Promise` chain instead
                Bugzilla.API.get(`bug/comment/tags/${encodeURIComponent(query)}`)
                    .then(data => data.map(tag => ({ value: tag })))
                    .catch(() => [])
                    .then(suggestions => done({ suggestions }));
            },
            formatResult: function(suggestion, currentValue) {
                // disable <b> wrapping of matched substring
                return suggestion.value.htmlEncode();
            }
        })
        .keydown(event => {
            if (event.which === 27) {
                event.preventDefault();
                hideTaggingUI();
            }
            else if (event.which === 13) {
                event.preventDefault();
                saveTag();
            }
        });

    $('#ctag-save')
        .click(event => {
            event.preventDefault();
            saveTag();
        });

    $('#ctag-cancel')
        .click(event => {
            event.preventDefault();
            hideTaggingUI();
        });

    $('.tag-btn')
        .click(function(event) {
            event.preventDefault();
            var that = $(this);
            var commentNo = that.data('no');
            var commentID = that.data('id');
            var ctag = $('#ctag');
            $('#ctag-error').hide();

            // toggle -> hide
            if (ctag.data('commentNo') === commentNo) {
                ctag.hide().data('commentNo', '');
                window.focus();
                return;
            }
            ctag.data('commentNo', commentNo);
            ctag.data('commentID', commentID);

            // kick off a refresh of the tags
            refreshTags(commentNo, commentID);

            // expand collapsed comments
            if ($('#ct-' + commentNo + ':visible').length === 0) {
                $('#cs-' + commentNo + ', #ccs-' + commentNo).click();
            }

            // move, show, and focus tagging ui
            ctag.prependTo('#ctag-' + commentNo + ' .comment-tags').show();
            $('#ctag-add').val('').focus();
        });

    $('.close-btn')
        .click(function(event) {
            event.preventDefault();
            $('#' + $(this).data('for')).hide();
        });

    updateTagsMenu();
    initReactions();
});

/**
 * Reference or define the Bugzilla app namespace.
 * @namespace
 */
var Bugzilla = Bugzilla || {}; // eslint-disable-line no-var

/**
 * Reference or define the Review namespace.
 * @namespace
 */
Bugzilla.BugModal = Bugzilla.BugModal || {};

/**
 * Implement the modal bug view's comment-related functionality.
 */
Bugzilla.BugModal.Comments = class Comments {
  /**
   * Initiate a new Comments instance.
   */
  constructor() {
    this.prepare_inline_attachments();
  }

  /**
   * Prepare to show an attachment inline if possible.
   */
  prepare_inline_attachments() {
    // Check the Bugzilla instance parameter, user setting, bug security, sensitive keywords, API
    // support and connectivity. If any of these conditions are not met, skip the inline attachment
    // rendering.
    if (
      !BUGZILLA.param.allow_attachment_display ||
      !BUGZILLA.user.settings.inline_attachments ||
      BUGZILLA.bug_secure ||
      /\b(?:hang|assertion|crash)\b/.test(BUGZILLA.bug_keywords ?? '') ||
      typeof IntersectionObserver !== 'function' ||
      navigator.connection?.type === 'cellular'
    ) {
      return;
    }

    document.querySelectorAll('.change-set').forEach($set => {
      // Skip if the comment has the `hide-attachment` tag
      const $comment = $set.querySelector('.comment:not([data-tags~="hide-attachment"])');
      // Skip if the attachment is obsolete or deleted
      const $attachment = $set.querySelector('.attachment:not(.obsolete):not(.deleted)');

      if ($comment && $attachment) {
        this.attachment = new Bugzilla.InlineAttachment($attachment);
      }
    });
  }
};

/**
 * Implement emoji comment reactions. Users can pick `+1`, `heart` and other emojis to react to a bug comment and see
 * the names of reacted users with a tooltip on the emoji buttons. This functionality makes use of the relatively new
 * Popover API with a WAI-ARIA-based fallback for older browsers, including Firefox 115 ESR.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Popover_API
 */
Bugzilla.BugModal.CommentReactions = class CommentReactions {
  /**
   * Check the availability of the Popover API. This also detects the CSS Anchor Positioning API, as positioning doesn’t
   * work well without it, depending on how the page layout (fixed global header) is structured.
   * @type {Boolean}
   */
  canUsePopover = 'popover' in HTMLElement.prototype && CSS.supports('anchor-name', '--comment-reactions');
  /** @type {Record<string, object[]> | null} */
  reactionCache = null;
  /** @type {Intl.ListFormat} */
  listFormatter = new Intl.ListFormat('en-US');

  /**
   * Initialize a new `CommentReactions` instance.
   * @param {HTMLElement} $wrapper Wrapper element with `.comment-reactions`.
   */
  constructor($wrapper) {
    /** @type {HTMLElement} */
    this.$wrapper = $wrapper;
    /** @type {HTMLElement & { popoverTargetElement?: HTMLElement, popoverTargetAction?: string }} */
    this.$anchor = $wrapper.querySelector('.anchor');
    /** @type {HTMLElement} */
    this.$picker = $wrapper.querySelector('.picker');
    /** @type {Number} */
    this.commentId = Number(/** @type {HTMLElement} */ ($wrapper.parentElement.querySelector('.comment')).dataset.id);
    /** @type {string} */
    this.anchorName = `--comment-${this.commentId}-reactions`;

    // Users cannot react on old bugs
    if (!this.$anchor) {
      return;
    }

    if (this.canUsePopover) {
      // Set the anchor name dynamically
      this.$wrapper.style.setProperty('anchor-name', this.anchorName);
      this.$picker.style.setProperty('position-anchor', this.anchorName);

      this.$anchor.popoverTargetElement = this.$picker;
      this.$anchor.popoverTargetAction = 'toggle';
      this.$picker.popover = 'auto';

      this.$picker.addEventListener('toggle', (/** @type {ToggleEvent} */ { newState }) => {
        this.$picker.inert = newState === 'closed';
      });

      // Work around Safari issues
      document.addEventListener('click', (event) => {
        if (event.target === this.$anchor) {
          event.stopPropagation();
          this.$picker.inert = !this.$picker.inert;
        } else if (this.isPickerOpen) {
          this.isPickerOpen = false;
        }
      });
    } else {
      this.$picker.id = `c${this.commentId}-reactions-picker`;
      this.$anchor.setAttribute('aria-haspopup', 'dialog');
      this.$anchor.setAttribute('aria-expanded', 'false');
      this.$anchor.setAttribute('aria-controls', this.$picker.id);

      this.$anchor.addEventListener('click', (event) => {
        event.stopPropagation();
        this.isPickerOpen = !this.isPickerOpen;
      });

      this.$picker.addEventListener('keydown', (event) => {
        if (this.isPickerOpen && event.key === 'Escape') {
          this.isPickerOpen = false;
        }
      });

      document.addEventListener('click', () => {
        if (this.isPickerOpen) {
          this.isPickerOpen = false;
        }
      });
    }

    // Automatically close the popover when the focus moves out
    document.addEventListener('focusin', () => {
      if (this.isPickerOpen && !this.$picker.contains(document.activeElement)) {
        this.isPickerOpen = false;
      }
    });

    this.buttons.forEach(($button) => {
      $button.addEventListener('click', async () => {
        this.toggleReaction($button);
      });

      if ($button.matches('.sum')) {
        $button.addEventListener('mouseenter', () => {
          this.updateButtons();
        });

        $button.addEventListener('focus', () => {
          this.updateButtons();
        });
      }
    });
  }

  /**
   * All the emoji buttons.
   */
  get buttons() {
    return /** @type {HTMLButtonElement[]} */ ([...this.$wrapper.querySelectorAll('button[data-reaction-name]')]);
  }

  /**
   * Whether the reaction picker is displayed.
   */
  get isPickerOpen() {
    return !this.$picker.inert;
  }

  /**
   * Open or close the reaction picker.
   */
  set isPickerOpen(open) {
    if (this.canUsePopover) {
      if (open) {
        this.$picker.showPopover();
      } else {
        this.$picker.hidePopover();
      }
    } else {
      if (!open && this.$picker.contains(document.activeElement)) {
        this.$anchor.focus();
      }

      this.$anchor.setAttribute('aria-expanded', String(open));
    }

    this.$picker.inert = !open;
  }

  /**
   * Retrieve the current reactions if a cache is not yet created, and update all the buttons, including the count and
   * tooltip.
   */
  async updateButtons() {
    this.reactionCache ??= await Bugzilla.API.get(`bug/comment/${this.commentId}/reactions`);

    this.buttons.forEach(($button) => {
      const { reactionName, reactionLabel } = $button.dataset;
      /** @type {{ id: number, nick: string, real_name: string, name: string }[]} */
      const reactedUsers = [...(this.reactionCache?.[reactionName] ?? [])];

      const totalCount = reactedUsers.length;
      const isMyReaction = reactedUsers.some((u) => u.id === BUGZILLA.user.id);
      const userNames = reactedUsers.splice(0, 10).map((u) => u.nick || u.real_name || u.name);
      const restCount = reactedUsers.length;

      if (restCount) {
        userNames.push(`${restCount} ${restCount > 1 ? 'others' : 'other'}`);
      }

      $button.dataset.reactionCount = String(totalCount);
      $button.setAttribute('aria-pressed', String(isMyReaction));

      if ($button.matches('.sum')) {
        const $count = $button.querySelector('.count');

        $button.title = totalCount ? `${this.listFormatter.format(userNames)} reacted with ${reactionLabel} emoji` : '';
        $button.hidden = !totalCount;
        $count.textContent = String(totalCount);
        $count.setAttribute(
          'aria-label',
          `${totalCount} ${totalCount === 1 ? 'person' : 'people'} reacted with ${reactionLabel} emoji`,
        );
      }
    });
  }

  /**
   * Add or remove a reaction via the API.
   * @param {HTMLButtonElement} $button Reaction button.
   */
  async toggleReaction($button) {
    const { reactionName, reactionCount } = $button.dataset;
    const action = $button.matches('[aria-pressed="true"]') ? 'remove' : 'add';
    const newCount = Number(reactionCount) + (action === 'add' ? 1 : -1);

    if (this.isPickerOpen) {
      this.isPickerOpen = false;
    }

    // Update the UI immediately without waiting for API response
    this.$wrapper
      .querySelectorAll(`button[data-reaction-name="${CSS.escape(reactionName)}"]`)
      .forEach((/** @type {HTMLButtonElement} */ $_button) => {
        $_button.dataset.reactionCount = String(newCount);
        $_button.setAttribute('aria-pressed', String(action === 'add'));

        if ($_button.matches('.sum')) {
          $_button.hidden = !newCount;
          $_button.querySelector('.count').textContent = String(newCount);
        }
      });

    this.reactionCache = await Bugzilla.API.put(`bug/comment/${this.commentId}/reactions`, {
      [action]: [reactionName],
    });

    this.updateButtons();
  }
};

/**
 * Implement the inline attachment renderer that will be used for bug comments. For a better performance, this
 * functionality uses the Intersection Observer API to show an attachment when the comment goes into the viewport.
 */
Bugzilla.InlineAttachment = class InlineAttachment {
  /**
   * Initiate a new InlineAttachment instance.
   * @param {HTMLElement} $attachment Attachment container on each comment.
   */
  constructor($attachment) {
    this.$attachment = $attachment;
    this.id = Number(this.$attachment.dataset.id);
    this.link = this.$attachment.querySelector('.link').href;
    this.name = this.$attachment.querySelector('[itemprop="name"]').content;
    this.size = Number(this.$attachment.querySelector('[itemprop="contentSize"]').content);
    this.type = this.$attachment.querySelector('[itemprop="encodingFormat"]').content;
    this.media = this.type.split('/').shift();

    // Show image smaller than 2 MB, excluding SVG and non-standard formats
    if (this.type.match(/^image\/(?!vnd|svg).+$/) && this.size < 2000000) {
      this.show_image();
    }

    // Show audio and video
    if (this.type.match(/^(?:audio|video)\/(?!vnd).+$/) && document.createElement(this.media).canPlayType(this.type)) {
      this.show_media();
    }

    // Detect text (code from attachment.js)
    this.is_patch = this.$attachment.matches('.patch');
    this.is_markdown = !!this.name.match(/\.(?:md|mkdn?|mdown|markdown)$/);
    this.is_source = !!this.name.match(/\.(?:cpp|es|h|js|json|rs|rst|sh|toml|ts|tsx|xml|yaml|yml)$/);
    this.is_text = this.type.match(/^text\/(?!x-).+$/) || this.is_patch || this.is_markdown || this.is_source;

    // Show text smaller than 50 KB
    if (this.is_text && this.size < 50000) {
      this.show_text();
    }
  }

  /**
   * Show an image attachment.
   */
  async show_image() {
    // Insert a placeholder first
    this.$attachment.insertAdjacentHTML('beforeend', `<a href="${this.link}" class="outer lightbox"></a>`);

    // Wait until the container goes into the viewport
    await this.watch_visibility();

    const $image = new Image();

    try {
      await new Promise((resolve, reject) => {
        $image.addEventListener('load', () => resolve(), { once: true });
        $image.addEventListener('error', () => reject(), { once: true });
        $image.src = this.link;
      });

      $image.setAttribute('itemprop', 'image');
      this.$outer.title = this.name;
      this.$outer.appendChild($image);
    } catch (ex) {
      this.$outer.remove();
    }
  }

  /**
   * Show an audio or video attachment.
   */
  async show_media() {
    // Insert a placeholder first
    this.$attachment.insertAdjacentHTML('beforeend', '<span class="outer"></span>');

    // Wait until the container goes into the viewport
    await this.watch_visibility();

    const $media = document.createElement(this.media);

    try {
      await new Promise((resolve, reject) => {
        $media.addEventListener('loadedmetadata', () => resolve(), { once: true });
        $media.addEventListener('error', () => reject(), { once: true });
        $media.src = this.link;
      });

      $media.setAttribute('itemprop', this.media);
      $media.controls = true;
      this.$outer.appendChild($media);
    } catch (ex) {
      this.$outer.remove();
    }
  }

  /**
   * Show a text attachment. Fetch the raw text via the API.
   */
  async show_text() {
    // Insert a placeholder first
    this.$attachment.insertAdjacentHTML('beforeend',
      `<button type="button" role="link" title="${this.name.htmlEncode()}" class="outer"></button>`);

    // Wait until the container goes into the viewport
    await this.watch_visibility();

    try {
      const { attachments } = await Bugzilla.API.get(`bug/attachment/${this.id}`, { include_fields: 'data' });
      const text = decodeURIComponent(escape(atob(attachments[this.id].data)));
      const lang = this.is_patch ? 'diff' : this.type.match(/\w+$/)[0];

      this.$outer.innerHTML = `<pre class="language-${lang}" role="img" itemprop="text">${text.htmlEncode()}</pre>`;

      // Make the button work as a link. It cannot be `<a>` because Prism Autolinker plugin may add links to `<pre>`
      this.$attachment.querySelector('[role="link"]').addEventListener('click', () => location.href = this.link);

      if (Prism) {
        Prism.highlightElement(this.$attachment.querySelector('pre'));
        this.$attachment.querySelectorAll('pre a').forEach($a => $a.tabIndex = -1);
      }
    } catch (ex) {
      this.$outer.remove();
    }
  }

  /**
   * Use the Intersection Observer API to watch the visibility of the attachment container.
   * @returns {Promise} Resolved once the container goes into the viewport.
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API
   */
  async watch_visibility() {
    this.$outer = this.$attachment.querySelector('.outer');

    return new Promise(resolve => {
      const observer = new IntersectionObserver(entries => entries.forEach(entry => {
        if (entry.intersectionRatio > 0) {
          observer.disconnect();
          resolve();
        }
      }), { root: document.querySelector('#bugzilla-body') });

      observer.observe(this.$attachment);
    });
  }
};

/**
 * Implement the instant update functionality that allows users to submit a new comment and change
 * certain fields without reloading the page. This functionality uses optimistic rendering to show a
 * placeholder comment immediately after the user submits a new comment, and then updates the
 * comment section with the new comment from the server response.
 */
Bugzilla.BugModal.InstantUpdate = class InstantUpdate {
  /** @type {HTMLFormElement} */
  static $form = null;
  /** @type {FormData} */
  static initialFormData = null;
  /** @type {HTMLTextAreaElement} */
  static $commentTextArea = null;
  /** @type {HTMLElement} */
  static $lastChangeSet = null;
  /** @type {HTMLElement} */
  static $placeholder = null;
  /** @type {File[]} */
  static attachments = [];

  /**
   * Initialize the instant update functionality. This captures the initial form data for later
   * change detection.
   */
  static init() {
    const $form = document.querySelector('#changeform');

    if (!$form) {
      return;
    }

    this.$form = $form;
    this.initialFormData = new FormData($form);
  }

  static API_PROP_MAP = {
    comment: 'comment',
    bug_status: 'status',
    resolution: 'resolution',
    dup_id: 'dupe_of',
    assigned_to: 'assigned_to',
  };

  static API_PROP_KEYS = Object.keys(this.API_PROP_MAP);

  static IGNORED_FIELDS = ['delta_ts', 'token', 'editing'];

  /**
   * Show a placeholder comment immediately after the user submits a new comment, and then update
   * the comment section with the new comment from the server response.
   * @throws {Error} When unsupported fields are changed or the submission fails.
   */
  static async submit() {
    this.#showPlaceholder();

    const currentFormData = new FormData(this.$form);
    /** @type {Record<string, any>} */
    const changedFields = {};

    currentFormData.forEach((value, key) => {
      if (!this.IGNORED_FIELDS.includes(key) && this.initialFormData.get(key) !== value) {
        changedFields[key] = value;
      }
    });

    const changedKeys = Object.keys(changedFields);

    // Use the API if only supported fields are changed
    if (!changedKeys.every((key) => this.API_PROP_KEYS.includes(key))) {
      throw new Error('Unsupported field changes detected.');
    }

    const is_markdown = BUGZILLA.param.use_markdown;

    // Update the initial form data for later change detection
    this.initialFormData = currentFormData;

    // If only the comment text is changed, use the faster comment-adding API
    if (changedKeys.length === 1 && changedKeys[0] === 'comment') {
      const { comment } = changedFields;

      await Bugzilla.API.post(`bug/${BUGZILLA.bug_id}/comment`, { comment, is_markdown });
    } else {
      const data = {};

      Object.entries(changedFields).forEach(([key, value]) => {
        data[API_PROP_MAP[key]] = key === 'comment' ? { body: value, is_markdown } : value;
      });

      await Bugzilla.API.put(`bug/${BUGZILLA.bug_id}`, data);
    }

    // if (this.attachments.length) {
    //   await Promise.all(
    //     this.attachments.map(async (file) =>
    //       Bugzilla.API.post(`bug/${BUGZILLA.bug_id}/attachment`, {
    //         data: await new Promise((resolve) => {
    //           const reader = new FileReader();

    //           reader.onload = () => {
    //             resolve(/** @type {string} */ (reader.result).split(',')[1]);
    //           };
    //           reader.readAsDataURL(file);
    //         }),
    //         file_name: file.name,
    //         summary: file.name,
    //         content_type: file.type || 'application/octet-stream',
    //         comment: '',
    //       })
    //     )
    //   );
    // }

    // Fetch the updated bug page to get the new rendered HTML. We are doing this because:
    // - Other users may add comments or change the bug status in the meantime
    // - The last change time has to be updated
    // - The CSRF token has to be updated
    const response = await fetch(`${BUGZILLA.config.basepath}show_bug.cgi?id=${BUGZILLA.bug_id}`);

    const html = await response.text();
    const updatedDoc = new DOMParser().parseFromString(html, 'text/html');

    if (!updatedDoc.querySelector('#changeform')) {
      // Something went wrong, e.g. mid-air collision, session timeout, or CSRF failure.
      throw new Error('Failed to submit the changes in background.');
    }

    this.#update(updatedDoc);
  }

  /**
   * Show a placeholder comment while waiting for the server response.
   */
  static async #showPlaceholder() {
    const changeSets = [...document.querySelectorAll('.change-set')];
    const $template = document.querySelector('#changeset-template');

    this.$commentTextArea = document.querySelector('#comment');
    this.$lastChangeSet = changeSets.pop();
    this.$placeholder = $template.content.firstElementChild.cloneNode(true);

    const $commentBody = this.$placeholder.querySelector('.comment-text');
    const rawComment = this.$commentTextArea.value;
    const commentCount = changeSets.filter(({ id }) => id.match(/^c\d+/)).length + 1

    this.$commentTextArea.readOnly = true;
    this.$commentTextArea.hidden = true;

    this.$placeholder.querySelector('.change-name a').textContent = `Comment ${commentCount}`;
    this.$placeholder.querySelector('.change-time span').textContent = 'Just now';
    this.$placeholder.querySelectorAll('button').forEach(($btn) => {
      $btn.disabled = true;
    });

    $commentBody.textContent = rawComment; // Do not use `innerHTML` here!
    $commentBody.classList.remove('empty');

    this.$lastChangeSet.insertAdjacentElement('afterend', this.$placeholder);

    const { html } = await Bugzilla.API.post('bug/comment/render', { text: rawComment });

    $commentBody.innerHTML = html; // Rendered HTML; safe to use `innerHTML` here
  }

  static VALUE_REPLACE_SELECTORS = ['input[name="delta_ts"]', 'input[name="token"]'];

  static CONTENT_REPLACE_SELECTORS = [
    '#field-status_summary',
    // '#field-status-edit',
    // '#after-comment-commit-button',
    // '#new-comment-actions',
  ];

  /**
   * Update the comment section with the new comment from the server response, and hydrate
   * interactive components such as emoji reactions and inline attachments.
   * @param {Document} updatedDoc Parsed HTML document from the server response.
   */
  static #update(updatedDoc) {
    this.#addNewChangeSets(updatedDoc);

    // Update the last change time and CSRF tokens in the form
    this.VALUE_REPLACE_SELECTORS.forEach((selector) => {
      document.querySelector(selector).value = updatedDoc.querySelector(selector).value;
    });

    // Re-enable and clear the comment textarea
    this.$commentTextArea.readOnly = false;
    this.$commentTextArea.hidden = false;
    this.$commentTextArea.value = '';

    // Re-enable the save button
    document.querySelectorAll('.save-btn').forEach(($btn) => {
      $btn.disabled = false;
    });

    // Update the status summary, including the timestamp
    // Update the needinfo other checkboxes below the comment textarea
    // Update the status/resolution buttons below the comment textarea
    this.CONTENT_REPLACE_SELECTORS.forEach((selector) => {
      document.querySelector(selector).innerHTML = updatedDoc.querySelector(selector).innerHTML;
    });

    // Re-initialize the needinfo widgets
    Bugzilla.NeedInfo.init();
  }

  /**
   * Replace the placeholder change set with the new change set from the server response, and
   * hydrate interactive components such as emoji reactions and inline attachments.
   * @param {Document} updatedDoc Parsed HTML document from the server response.
   */
  static #addNewChangeSets(updatedDoc) {
    /** @type {HTMLElement[]} */
    const allChangeSets = [...updatedDoc.querySelectorAll('.change-set')];
    const lastChangeSetIndex = allChangeSets.findIndex(
      ($changeSet) => $changeSet.id === this.$lastChangeSet.id,
    );

    // Slice the change sets to get only the new ones. There may be more than one if other users
    // have made changes in the meantime
    const newChangeSets = allChangeSets.slice(lastChangeSetIndex + 1);

    this.$placeholder.replaceWith(...newChangeSets);

    newChangeSets.forEach(($changeSet) => {
      this.#hydrateChangeSet($changeSet);
    });
  }

  /**
   * Hydrate interactive components such as emoji reactions and inline attachments in a change set.
   * @param {HTMLElement} $changeSet Change set element.
   */
  static #hydrateChangeSet($changeSet) {
    const $comment = $changeSet.querySelector('.comment-text');
    const $reactions = $changeSet.querySelector('.comment-reactions');
    const $attachment = $changeSet.querySelector('.attachment');

    if ($comment) {
      Bugzilla.InlineCommentEditor.activate($changeSet);
    }

    if ($reactions) {
      new Bugzilla.BugModal.CommentReactions($reactions);
    }

    if ($attachment) {
      new Bugzilla.InlineAttachment($attachment);
    }
  }
};

document.addEventListener('DOMContentLoaded', () => new Bugzilla.BugModal.Comments(), { once: true });
document.addEventListener('DOMContentLoaded', () => Bugzilla.BugModal.InstantUpdate.init(), { once: true });
