/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0. */

// init

window.addEventListener('DOMContentLoaded', () => {
  try {
    if (document.getElementById('flag_list')) {
        filter_flag_list(document.getElementById('filter').checked);
    }
    else {
        const $name = document.getElementById('flag_name');
        const $desc = document.getElementById('flag_desc');
        const $type = document.getElementById('flag_type');
        const $sort = document.getElementById('flag_sort');

        $name.addEventListener('change', (event) => {
            change_flag_name(event, $name);
        });
        $desc.addEventListener('change', (event) => {
            change_string_value(event, $desc);
        });
        $type.addEventListener('change', (event) => {
            change_select_value(event, $type);
        });
        $sort.addEventListener('change', (event) => {
            change_int_value(event, $sort);
        });
        document.getElementById('product').addEventListener('change', () => {
            if (document.getElementById('product').value == '')
                document.getElementById('component').options.length = 0;
        });

        update_flag_values();
        update_flag_visibility();
        tag_missing_values();
    }
  } catch(e) {
    console.error(e);
  }
});

// field

function change_flag_name(e, o) {
    change_string_value(e, o);
    if (o.value == '')
        return;
    o.value = o.value.replace(/[^a-z0-9_]/g, '_');
    if (!o.value.match(/^cf_/))
        o.value = 'cf_' + o.value;
    if (document.getElementById('flag_desc').value == '') {
        var desc = o.value;
        desc = desc.replace(/^cf_/, '');
        desc = desc.replace(/_/g, '-');
        document.getElementById('flag_desc').value = desc;
        tag_missing_value(document.getElementById('flag_desc'));
    }
}

function inc_field(id, amount) {
    var el = document.getElementById(id);
    el.value = el.value.match(/-?\d+/) * 1 + amount;
    change_int_value(null, el);
}

// values

function update_flag_values() {
    // update the values table from the flag_values global

    var tbl = document.getElementById('flag_values');
    if (!tbl)
        return;

    // remove current entries
    while (tbl.rows.length > 3) {
        tbl.deleteRow(2);
    }

    // add all entries

    for (let i = 0, l = flag_values.length; i < l; i++) {
        const value = flag_values[i];

        let row = tbl.insertRow(2 + (i * 2));
        let cell;

        // value
        cell = row.insertCell(0);
        if (value.value == '---') {
            cell.innerHTML = '---';
        }
        else {
            const inputEl = document.createElement('input');
            inputEl.id = 'value_' + i;
            inputEl.type = 'text';
            inputEl.className = 'option_value';
            inputEl.value = value.value;
            inputEl.addEventListener('change', (e) => {
                change_string_value(e, inputEl);
                flag_values[inputEl.id.match(/\d+$/)].value = inputEl.value;
                tag_invalid_values();
            });
            inputEl.addEventListener('change', (e) => {
                if ((e.key || e.keyCode) == 27 && inputEl.value == '')
                    remove_value(inputEl.id.match(/\d+$/));
            });
            cell.appendChild(inputEl);
        }

        // setter
        cell = row.insertCell(1);
        const selectEl = document.createElement('select');
        selectEl.id = 'setter_' + i;
        selectEl.addEventListener('change', () => {
            change_select_value(event, selectEl);
        });
        let optionEl = document.createElement('option');
        optionEl.value = '';
        selectEl.appendChild(optionEl);
        for (var j = 0, m = groups.length; j < m; j++) {
            var group = groups[j];
            optionEl = document.createElement('option');
            optionEl.value = group.id;
            optionEl.innerHTML = group.name.htmlEncode();
            optionEl.selected = group.id == value.setter_group_id;
            selectEl.appendChild(optionEl);
        }
        selectEl.addEventListener('change', () => {
            flag_values[selectEl.id.match(/\d+$/)].setter_group_id = selectEl.value;
            tag_invalid_values();
        });
        cell.appendChild(selectEl);

        // active
        cell = row.insertCell(2);
        if (value.value == '---') {
            cell.innerHTML = 'Yes';
        }
        else {
            const inputEl = document.createElement('input');
            inputEl.type = 'checkbox';
            inputEl.id = 'is_active_' + i;
            inputEl.checked = value.is_active;
            inputEl.addEventListener('change', () => {
                flag_values[inputEl.id.match(/\d+$/)].is_active = inputEl.checked;
            });
            cell.appendChild(inputEl);
        }

        // actions
        cell = row.insertCell(3);
        var html =
            '[' +
            (i == 0
                ? '<span class="txt_icon">&nbsp;-&nbsp;</span>'
                : '<a class="txt_icon" href="#" onclick="value_move_up(' + i + ');return false"> &Delta; </a>'
            ) +
            '|' +
            (i == l - 1
                ? '<span class="txt_icon">&nbsp;-&nbsp;</span>'
                : '<a class="txt_icon" href="#" onclick="value_move_down(' + i + ');return false"> &nabla; </a>'
            );
        if (value.value != '---') {
            var lbl = value.comment == '' ? 'Set Comment' : 'Edit Comment';
            html +=
                '|<a href="#" onclick="remove_value(' + i + ');return false">Remove</a>' +
                '|<a href="#" onclick="toggle_value_comment(this, ' + i + ');return false">' + lbl + '</a>'

        }
        html += ' ]';
        cell.innerHTML = html;

        row = tbl.insertRow(3 + (i * 2));
        row.className = 'bz_default_hidden';
        row.id = 'comment_row_' + i;
        cell = row.insertCell(0);
        cell = row.insertCell(1);
        cell.colSpan = 3;
        const ta = document.createElement('textarea');
        ta.className = 'value_comment';
        ta.id = 'value_comment_' + i;
        ta.rows = 5;
        ta.value = value.comment;
        cell.appendChild(ta);
        ta.addEventListener('blur', () => {
            flag_values[i].comment = ta.value;
        });
    }

    tag_invalid_values();
}

function tag_invalid_values() {
    // reset
    for (var i = 0, l = flag_values.length; i < l; i++) {
        document.getElementById(`value_${i}`)?.classList.remove('admin_error');
    }

    for (var i = 0, l = flag_values.length; i < l; i++) {
        // missing
        if (flag_values[i].value == '')
            document.getElementById(`value_${i}`)?.classList.add('admin_error');
        if (!flag_values[i].setter_group_id)
            document.getElementById(`setter_${i}`).classList.add('admin_error');

        // duplicate values
        for (var j = i; j < l; j++) {
            if (i != j && flag_values[i].value == flag_values[j].value) {
                document.getElementById(`value_${i}`)?.classList.add('admin_error');
                document.getElementById(`value_${j}`).classList.add('admin_error');
            }
        }
    }
}

function value_move_up(idx) {
    if (idx == 0)
        return;
    var tmp = flag_values[idx];
    flag_values[idx] = flag_values[idx - 1];
    flag_values[idx - 1] = tmp;
    update_flag_values();
}

function value_move_down(idx) {
    if (idx == flag_values.length - 1)
        return;
    var tmp = flag_values[idx];
    flag_values[idx] = flag_values[idx + 1];
    flag_values[idx + 1] = tmp;
    update_flag_values();
}

function add_value() {
    var value = new Object();
    value.id = 0;
    value.value = '';
    value.setter_group_id = '';
    value.is_active = true;
    var idx = flag_values.length;
    flag_values[idx] = value;
    update_flag_values();
    document.getElementById(`value_${idx}`).focus();
}

function remove_value(idx) {
    flag_values.splice(idx, 1);
    update_flag_values();
}

function update_value(e, o) {
    var i = o.value.match(/\d+/);
    flag_values[i].value = o.value;
}

function toggle_value_comment(btn, idx) {
    var row = document.getElementById(`comment_row_${idx}`);
    if (row.matches('.bz_default_hidden')) {
        row.classList.remove('bz_default_hidden');
        btn.innerHTML = 'Hide Comment';
        document.getElementById(`value_comment_${idx}`).select();
        document.getElementById(`value_comment_${idx}`).focus();
    } else {
        row.classList.add('bz_default_hidden');
        btn.innerHTML = flag_values[idx].comment == '' ? 'Set Comment' : 'Edit Comment';
    }
}

// visibility

function update_flag_visibility() {
    // update the visibility table from the flag_visibility global

    var tbl = document.getElementById('flag_visibility');
    if (!tbl)
        return;

    // remove current entries
    while (tbl.rows.length > 3) {
        tbl.deleteRow(2);
    }

    // show something if there aren't any components

    if (!flag_visibility.length) {
        var row = tbl.insertRow(2);
        var cell = row.insertCell(0);
        cell.innerHTML = '<i class="admin_error_text">missing</i>';
    }

    // add all entries

    for (var i = 0, l = flag_visibility.length; i < l; i++) {
        var visibility = flag_visibility[i];

        var row = tbl.insertRow(2 + i);
        var cell;

        // product
        cell = row.insertCell(0);
        cell.innerHTML = visibility.product;

        // component
        cell = row.insertCell(1);
        cell.innerHTML = visibility.component
            ? visibility.component
            : '<i>-- Any --</i>';

        // actions
        cell = row.insertCell(2);
        cell.innerHTML = '[ <a href="#" onclick="remove_visibility(' + i + ');return false">Remove</a> ]';
    }
}

function add_visibility() {
    // validation
    var product = document.getElementById('product').value;
    var component = document.getElementById('component').value;
    if (!product) {
        alert('Please select a product.');
        return;
    }

    // don't allow duplicates
    for (var i = 0, l = flag_visibility.length; i < l; i++) {
        if (flag_visibility[i].product == product && flag_visibility[i].component == component) {
            document.getElementById('product').value = '';
            document.getElementById('component').options.length = 0;
            return;
        }
    }

    if (component == '') {
        // if we're adding an "any" component, remove non-any components
        for (var i = 0; i < flag_visibility.length; i++) {
            var visibility = flag_visibility[i];
            if (visibility.product == product) {
                flag_visibility.splice(i, 1);
                i--;
            }
        }
    }
    else {
        // don't add non-any components if an "any" component exists
        for (var i = 0, l = flag_visibility.length; i < l; i++) {
            var visibility = flag_visibility[i];
            if (visibility.product == product && !visibility.component)
                return;
        }
    }

    // add to model
    var visibility = new Object();
    visibility.id = 0;
    visibility.product = product;
    visibility.component = component;
    flag_visibility[flag_visibility.length] = visibility;

    // update ui
    update_flag_visibility();
    document.getElementById('product').value = '';
    document.getElementById('component').options.length = 0;
}

function remove_visibility(idx) {
    flag_visibility.splice(idx, 1);
    update_flag_visibility();
}

// validation and submission

function tag_missing_values() {
    var els = document.getElementsByTagName('input');
    for (var i = 0, l = els.length; i < l; i++) {
        var el = els[i];
        if (el.id.match(/^(flag|value)_/))
            tag_missing_value(el);
    }
    tag_missing_value(document.getElementById('flag_type'));
}

function tag_missing_value(el) {
    el.classList.toggle('admin_error', !el.value);
}

function delete_confirm(flag) {
    if (confirm('Are you sure you want to delete the flag ' + flag + ' ?')) {
        document.getElementById('delete').value = 1;
        return true;
    }
    else {
        return false;
    }
}

function on_submit() {
    if (document.getElementById('delete')?.value)
        return;
    // let Perl manage most validation errors, because they are clearly marked
    // the exception is an empty visibility list, so catch that here as well
    if (!flag_visibility.length) {
        alert('You must provide at least one product for visibility.');
        return false;
    }

    document.getElementById('values').value = JSON.stringify(flag_values);
    document.getElementById('visibility').value = JSON.stringify(flag_visibility);
    return true;
}

// flag list

function filter_flag_list(show_disabled) {
    document.querySelectorAll('#flag_list tr.flag_row.is_disabled').forEach(($row) => {
        $row.classList.toggle('bz_default_hidden', !show_disabled);
    });
}

// utils

function change_string_value(e, o) {
    o.value = o.value.trim();
    tag_missing_value(o);
}

function change_int_value(e, o) {
    o.value = o.value.match(/-?\d+/);
    tag_missing_value(o);
}

function change_select_value(e, o) {
    tag_missing_value(o);
}
