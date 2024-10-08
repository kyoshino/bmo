/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0. */

function show_clone_menu(el, bug_id, product, component) {
  var base_url = `${BUGZILLA.config.basepath}enter_bug.cgi?format=__default__&cloned_bug_id=${bug_id}`;
  var items = {
    curr_prod : {
      name: 'Clone to the current product',
      callback: function () {
        var curr_url = base_url +
          '&product=' + encodeURIComponent(product) +
          '&component=' + encodeURIComponent(component);
        window.open(curr_url, '_blank');
      }
    },
    diff_prod: {
      name: 'Clone to a new product',
      callback: function () {
        window.open(base_url, '_blank');
      }
    }
  };
  $.contextMenu({
    selector: '#' + el.id,
    trigger: 'left',
    items: items
  });
}

// -- make attachment table, comments, new comment textarea equal widths

window.addEventListener('DOMContentLoaded', () => {
  var $comment_table = document.querySelector('#comments table.bz_comment_table');
  if ($comment_table) {
    var comment_width = $comment_table.querySelector('td').clientWidth + 'px';
    var attachment_table = document.getElementById('attachment_table');
    if (attachment_table)
      attachment_table.style.width = comment_width;
  }
  $('#cab-review-gate-close')
    .click(function(event) {
      event.preventDefault();
      $('#cab-review-gate').hide();
      $('#cab-review-edit').show();
    });
});
