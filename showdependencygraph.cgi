#!/usr/bin/env perl
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
#
# This Source Code Form is "Incompatible With Secondary Licenses", as
# defined by the Mozilla Public License, v. 2.0.

use 5.10.1;
use strict;
use warnings;

use lib qw(. lib local/lib/perl5);

use File::Temp;
use MIME::Base64 qw(encode_base64);

use Bugzilla;
use Bugzilla::Constants;
use Bugzilla::Install::Filesystem;
use Bugzilla::Util;
use Bugzilla::Error;
use Bugzilla::Bug;
use Bugzilla::Status;

Bugzilla->login(LOGIN_REQUIRED);

my $cgi      = Bugzilla->cgi;
my $template = Bugzilla->template;
my $vars     = {};

# Connect to the shadow database if this installation is using one to improve
# performance.
my $dbh = Bugzilla->switch_to_shadow_db();

my (%seen, %edgesdone, %bugtitles);
my $bug_count = 0;

# $CreateImagemap: This sub grabs a local filename as a parameter, reads the
# dot-generated image map datafile residing in that file and turns it into
# an HTML map element. THIS SUB IS ONLY USED FOR LOCAL DOT INSTALLATIONS.
# The map datafile won't necessarily contain the bug summaries, so we'll
# pull possible HTML titles from the %bugtitles hash (filled elsewhere
# in the code)

# The dot mapdata lines have the following format (\nsummary is optional):
# rectangle (LEFTX,TOPY) (RIGHTX,BOTTOMY) URLBASE/show_bug.cgi?id=BUGNUM BUGNUM[\nSUMMARY]

# force this to be lexical, so it can close over %bugtitles
my $CreateImagemap = sub {
  my $mapfilename = shift;
  my $map         = "<map name=\"imagemap\">\n";
  my $default     = "";

  open MAP, "<", $mapfilename;
  while (my $line = <MAP>) {
    if ($line =~ /^default ([^ ]*)(.*)$/) {
      $default = qq{<area alt="" shape="default" href="$1">\n};
    }

    if ($line
      =~ /^rectangle \((\d+),(\d+)\) \((\d+),(\d+)\) (http[^ ]*) (\d+)(?:\\n.*)?$/)
    {
      my ($leftx, $rightx, $topy, $bottomy, $url, $bugid) = ($1, $3, $2, $4, $5, $6);

      # Pick up bugid from the mapdata label field. Getting the title from
      # bugtitle hash instead of mapdata allows us to get the summary even
      # when showsummary is off, and also gives us status and resolution.
      # This text is safe; it has already been escaped.
      my $bugtitle = $bugtitles{$bugid};

      # The URL is supposed to be safe, because it's built manually.
      # But in case someone manages to inject code, it's safer to escape it.
      $url = html_quote($url);

      $map
        .= qq{<area alt="bug $bugid" name="bug$bugid" shape="rect" }
        . qq{title="$bugtitle" href="$url" }
        . qq{coords="$leftx,$topy,$rightx,$bottomy">\n};
    }
  }
  close MAP;

  $map .= "$default</map>";
  return $map;
};

my $AddLink = sub {
  my ($blocked, $dependson, $fh) = (@_);
  my $key = "$blocked,$dependson";
  if (!exists $edgesdone{$key}) {
    $edgesdone{$key} = 1;
    print $fh "$dependson -> $blocked\n";
    $bug_count++;
    $seen{$blocked}   = 1;
    $seen{$dependson} = 1;
  }
};

ThrowCodeError("missing_bug_id") if !defined $cgi->param('id');

# The list of valid directions. Some are not proposed in the dropdrown
# menu despite the fact that they are valid.
my @valid_rankdirs = ('LR', 'RL', 'TB', 'BT');

my $rankdir = $cgi->param('rankdir') || 'TB';

# Make sure the submitted 'rankdir' value is valid.
if (!grep { $_ eq $rankdir } @valid_rankdirs) {
  $rankdir = 'TB';
}

my $display = $cgi->param('display') || 'tree';
my $webdotdir = bz_locations()->{'webdotdir'};

my ($fh, $filename) = File::Temp::tempfile(
  "XXXXXXXXXX",
  SUFFIX => '.dot',
  DIR    => $webdotdir,
  UNLINK => 1
);

chmod Bugzilla::Install::Filesystem::CGI_WRITE, $filename
  or warn install_string('chmod_failed', {path => $filename, error => $!});

my $urlbase = Bugzilla->localconfig->urlbase;

print $fh "digraph G {";
print $fh qq(
graph [URL="${urlbase}query.cgi", rankdir=$rankdir]
node [URL="${urlbase}show_bug.cgi?id=\\N", style=filled, color=lightgray]
);

my %baselist;

foreach my $i (split('[\s,]+', $cgi->param('id'))) {
  my $bug = Bugzilla::Bug->check($i);
  $baselist{$bug->id} = 1;
}

my @stack = keys(%baselist);

if ($display eq 'web') {
  my $sth = $dbh->prepare(
    q{SELECT blocked, dependson
                                FROM dependencies
                               WHERE blocked = ? OR dependson = ?}
  );

  foreach my $id (@stack) {
    my $dependencies = $dbh->selectall_arrayref($sth, undef, ($id, $id));
    foreach my $dependency (@$dependencies) {
      my ($blocked, $dependson) = @$dependency;
      if ($blocked != $id && !exists $seen{$blocked}) {
        push @stack, $blocked;
      }
      if ($dependson != $id && !exists $seen{$dependson}) {
        push @stack, $dependson;
      }
      $AddLink->($blocked, $dependson, $fh);
    }
  }
}

# This is the default: a tree instead of a spider web.
else {
  my @blocker_stack = @stack;
  foreach my $id (@blocker_stack) {
    my $blocker_ids
      = Bugzilla::Bug::list_relationship('dependencies', 'blocked', 'dependson', $id);
    foreach my $blocker_id (@$blocker_ids) {
      push(@blocker_stack, $blocker_id) unless $seen{$blocker_id};
      $AddLink->($id, $blocker_id, $fh);
    }
  }
  my @dependent_stack = @stack;
  foreach my $id (@dependent_stack) {
    my $dep_bug_ids
      = Bugzilla::Bug::list_relationship('dependencies', 'dependson', 'blocked', $id);
    foreach my $dep_bug_id (@$dep_bug_ids) {
      push(@dependent_stack, $dep_bug_id) unless $seen{$dep_bug_id};
      $AddLink->($dep_bug_id, $id, $fh);
    }
  }
}

foreach my $k (keys(%baselist)) {
  $seen{$k} = 1;
}

my $sth = $dbh->prepare(
  q{SELECT bug_status, resolution, short_desc
                  FROM bugs
                 WHERE bugs.bug_id = ?}
);
foreach my $k (keys(%seen)) {

  # Retrieve bug information from the database
  my ($stat, $resolution, $summary) = $dbh->selectrow_array($sth, undef, $k);

  $vars->{'short_desc'} = $summary if ($k eq $cgi->param('id'));

  # Resolution and summary are shown only if user can see the bug
  if (Bugzilla->user->can_see_bug($k)) {
    $summary = html_quote(clean_text($summary));
  }
  else {
    $resolution = $summary = '';
  }

  my @params;

  if ($summary ne "" && $cgi->param('showsummary')) {

    # Wide characters cause GraphViz to die.
    if (Bugzilla->params->{'utf8'}) {
      utf8::encode($summary) if utf8::is_utf8($summary);
    }
    $summary = wrap_comment($summary);
    $summary =~ s/([\\\"])/\\$1/g;
    $summary =~ s/\n/\\n/g;
    push(@params, qq{label="$k\\n$summary"});
  }

  if (exists $baselist{$k}) {
    push(@params, "shape=box");
  }

  if (is_open_state($stat)) {
    push(@params, "color=green");
  }

  if (@params) {
    print $fh "$k [" . join(',', @params) . "]\n";
  }
  else {
    print $fh "$k\n";
  }

  # Push the bug tooltip texts into a global hash so that
  # $CreateImagemap sub (used with local dot installations) can
  # use them later on.
  $bugtitles{$k} = trim("$stat $resolution");

  # Show the bug summary in tooltips only if not shown on
  # the graph and it is non-empty (the user can see the bug)
  if (!$cgi->param('showsummary') && $summary ne "") {
    $bugtitles{$k} .= " - $summary";
  }
}


print $fh "}\n";
close $fh;

if ($bug_count > MAX_WEBDOT_BUGS) {
  unlink($filename);
  ThrowUserError("webdot_too_large");
}

my $webdotbase = Bugzilla->params->{'webdotbase'};

if ($webdotbase =~ /^https?:/) {
  $webdotbase =~ s/%(?:sslbase|urlbase)%/Bugzilla->localconfig->urlbase/eg;
  my $url = $webdotbase . $filename;
  $vars->{'image_url'} = $url . ".gif";
  $vars->{'map_url'}   = $url . ".map";
}
else {
  # Local dot installation
  my $image_data;
  open(my $pipe, '-|', $webdotbase, '-Tpng', $filename) || ThrowCodeError('webdot_error');
  binmode $pipe;
  while (my $dot_data = <$pipe>) {
    $image_data .= $dot_data;
  }
  close $pipe || ThrowCodeError('webdot_error');

  $vars->{'image_data'} = encode_base64($image_data);

  # Then, generate a imagemap datafile that contains the corner data
  # for drawn bug objects. Pass it on to $CreateImagemap that
  # turns this monster into HTML.

  my ($mapfh, $mapfilename)
    = File::Temp::tempfile("XXXXXXXXXX", SUFFIX => '.map', DIR => $webdotdir);

  chmod Bugzilla::Install::Filesystem::WS_SERVE, $mapfilename
    or warn install_string('chmod_failed', {path => $mapfilename, error => $!});

  binmode $mapfh;
  open(DOT, '-|', "\"$webdotbase\" -Tismap $filename");
  binmode DOT;
  print $mapfh $_ while <DOT>;
  close DOT;
  close $mapfh;

  $vars->{'image_map'} = $CreateImagemap->($mapfilename);
}

# Cleanup any old .dot files created from previous runs.
my $since = time() - 24 * 60 * 60;

# Can't use glob, since even calling that fails taint checks for Perl < 5.6
opendir(DIR, $webdotdir);
my @files = grep { /\.dot$|\.png$|\.map$/ && -f "$webdotdir/$_" } readdir(DIR);
closedir DIR;
foreach my $f (@files) {
  $f = "$webdotdir/$f";

  # Here we are deleting all old files. All entries are from the
  # $webdot directory. Since we're deleting the file (not following
  # symlinks), this can't escape to delete anything it shouldn't
  # (unless someone moves the location of $webdotdir, of course)
  my $mtime = file_mod_time($f);
  if ($mtime && $mtime < $since) {
    unlink $f;
  }
}

# Make sure we only include valid integers (protects us from XSS attacks).
my @bugs = grep(detaint_natural($_), split(/[\s,]+/, $cgi->param('id')));
$vars->{'bug_id'}        = join(', ', @bugs);
$vars->{'multiple_bugs'} = ($cgi->param('id') =~ /[ ,]/);
$vars->{'display'}       = $display;
$vars->{'rankdir'}       = $rankdir;
$vars->{'showsummary'}   = $cgi->param('showsummary');

# Generate and return the UI (HTML page) from the appropriate template.
print $cgi->header();
$template->process("bug/dependency-graph.html.tmpl", $vars)
  || ThrowTemplateError($template->error());
