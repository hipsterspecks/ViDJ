Rooms = new Meteor.Collection("rooms");
Videos = new Meteor.Collection("videosQue");

var AmplifiedSession = _.extend({}, Session, {
  keys: _.object(_.map(amplify.store(), function (value, key) {
    return [key, JSON.stringify(value)];
  })),
  set: function (key, value) {
    Session.set.apply(this, arguments);
    amplify.store(key, value);
  }
});

Meteor.startup(function () {
  AmplifiedSession.set('room_id', null);
  AmplifiedSession.set('videos', null);
  AmplifiedSession.set('videos_id', null);
  AmplifiedSession.set('playing', false);
  AmplifiedSession.set('adding', false);
  // addvideopage switch add method
  AmplifiedSession.set('linkGrabber', false);
});

var videosHandle = null;

Deps.autorun(function(){
  var room_id = AmplifiedSession.get('room_id');
  if (room_id)
    videosHandle = Meteor.subscribe('videosQue', room_id);
  else
    videosHandle = null;
});

/////////////////// Routing ///////////////////

Meteor.Router.add({
  '/rooms/new/add': 'CreateARoom',
  '/rooms/find':'FindRoom',
  '/rooms/:id/addVideo' : function(id) {
    AmplifiedSession.set("room_id", id);
    if(AmplifiedSession.get("room_id"))
      return 'AddVideoScreen';
  },
  '/rooms/:id/mode' : function(id) {
    AmplifiedSession.set("room_id", id);
    if(AmplifiedSession.get("room_id"))
      return 'ChooseModeScreen';
  },
  '/rooms/:id' : function(id) {
    AmplifiedSession.set("room_id", id);
    AmplifiedSession.set('playing', false);
    if(AmplifiedSession.get("room_id"))
      return 'EnteredRoom';
  },
  '/rooms' : function() {
    AmplifiedSession.set('room_id', null);
    AmplifiedSession.set('videos', null);
    AmplifiedSession.set('videos_id', null);
    AmplifiedSession.set('playing', false);
    return 'BrowseRooms';
  },
  '/about' : 'about',
  '/loadingPage' :'loadingPage',
  '/': 'Home',
  '/contact': 'Contact'
});

/////////////////// Entered Room ///////////////////
Template.EnteredRoom.loading = function () {
  return videosHandle && !videosHandle.ready();
};

Template.EnteredRoom.room = function () {
  return Rooms.findOne({urlId:AmplifiedSession.get('room_id')});
};

Template.EnteredRoom.adding = function () {
  return !AmplifiedSession.get('adding');
};

Template.EnteredRoom.video_objs = function () {
  if (Videos.findOne({room_id: AmplifiedSession.get('room_id')}) && Videos.findOne({room_id: AmplifiedSession.get('room_id')}).videoIds)
    return Videos.findOne({room_id: AmplifiedSession.get('room_id')}).videoIds.length;
  else
    return 0;
};

Template.EnteredRoom.rendered = function () {
  $("#searchTerms").keyup(function (e) {
    if (e.keyCode == 13)
      searchVids();
  });
  if(!AmplifiedSession.get('playing') && !AmplifiedSession.get('adding') && AmplifiedSession.get('videos') && AmplifiedSession.get('videos').videoIds.length) {
    $('#youtube-video').show();
    AmplifiedSession.set('playing', true);
    var currVid = 0; // AmplifiedSession.get('videos').currentVideoIndex, 
        playlist = AmplifiedSession.get('videos').videoIds;
    
    renderVid(playlist, currVid);
  }
};

Template.EnteredRoom.videoData = function() {
  AmplifiedSession.set('videos', Videos.findOne({room_id: AmplifiedSession.get('room_id')}));
  if (AmplifiedSession.get('videos') && AmplifiedSession.get('videos').videoIds)
    getPlaylist();

  return 0;
};

var video= {};

var renderVid = function(playlist, currVid) {
  video = Popcorn.smart('#youtube-video', 'http://www.youtube.com/embed/' + playlist[currVid] + '&html5=1');
  var tmp = $('#playlist')[0].firstChild;
  video.on("ended", function() {
    playlist = AmplifiedSession.get('videos').videoIds;
    if (++currVid < AmplifiedSession.get('videos').videoIds.length) 
      renderVid(playlist, currVid);
    else {
      AmplifiedSession.set('playing', false);
      $('#youtube-video').hide();
      $('.error').show();
    }
  });
};

var searchVids = function() {
  var searchTerms = $('#searchTerms').val();
  var request = gapi.client.youtube.search.list({
    q: searchTerms,
    part: 'snippet',
    type: 'video',
    maxResults: 10
  });
  request.execute(function(response) {
    var color;
    $('#results').html('');
    for (var i = 0; i < response.result.items.length; i++) {
      var style = color ? "blue" : "purp";
      color = !color;
      $('#results').append('<div class="choose"><span class="future col-lg-12 ' + style + '">' + response.result.items[i].snippet.title + 'from </br>' + response.result.items[i].snippet.channelTitle + '<span class="hidden vId">' + response.result.items[i].id.videoId + '</span></span></div>');
    };
  });
};

var getPlaylist = function() {
  var ids = "", color = false;
  for(var i = 0; i < AmplifiedSession.get('videos').videoIds.length; i++) {
    ids += AmplifiedSession.get('videos').videoIds[i];
    if (i < AmplifiedSession.get('videos').videoIds.length - 1)
      ids += ',';
  }
  gapi.client.setApiKey("AIzaSyCnGXLE1spj9r30DJAkXCXcrAVCBXV73xM");
  gapi.client.load('youtube', 'v3', function() { 
    var request = gapi.client.youtube.videos.list({part:'snippet', id: ids});
    request.execute(function(response) {
      $('#playlist').html('');
      for(var i = 0; i < response.items.length; i++) {
        var style = color ? "blue" : "purp";
        color = !color;
        $('#playlist').append('<div class="next"><span class="future col-lg-12 ' + style + '">' + response.items[i].snippet.title + '<span class="hidden vId">' + i + '</span></span></div>');
      }
    });
  });
};

Template.EnteredRoom.events({
  'click #toAddVideo' : function () {
    AmplifiedSession.set('adding', true);
  },
  'click .delete' : function() {
    AmplifiedSession.set('adding', false);
  },
  'click .searchYoutube' : function() {
    searchVids();
  },
  'click .choose' : function(event) {
    var chosen = event.srcElement.children[1].childNodes[0].data;
    vid_id = AmplifiedSession.get('videos_id') ? AmplifiedSession.get('videos_id') : Videos.findOne({room_id: AmplifiedSession.get('room_id')})._id;
    Videos.update({ _id: vid_id}, {$inc:{totalVideos:1},
                                   $push:{videoIds: chosen}}, function (error) {
      if (error) 
        console.log(error);

      AmplifiedSession.set('adding', false);
    });
  },
  'click .next' : function(event) {
    video.destroy();
    var currVid = event.srcElement.children[0].childNodes[0].data, playlist = AmplifiedSession.get('videos').videoIds;
    renderVid(playlist, currVid);
  },
  'click #toFullscreen' : function() {
    var target = $('.currRoom')[0];
    if (screenfull.enabled) 
      screenfull.request(target);
  }
});

/////////////////// Choose Mode ///////////////////

Template.ChooseModeScreen.events({
  'click .theater' : function() {
    AmplifiedSession.set('mode', 'theater');
  },
  'click .submitter' : function() {
    AmplifiedSession.set('mode', 'submitter');
  }
});

Template.ChooseModeScreen.room = function () {
  return Rooms.findOne({urlId: AmplifiedSession.get('room_id')});
};

/////////////////// Add Video ///////////////////

Template.AddVideoScreen.room = function () {
  return Rooms.findOne({urlId: AmplifiedSession.get('room_id')});
};

Template.AddVideoScreen.videoData = function() {
  AmplifiedSession.set('videos', Videos.findOne({room_id: AmplifiedSession.get('room_id')}));
  if (AmplifiedSession.get('videos') && AmplifiedSession.get('videos').videoIds) 
    getPlaylist();

  return "Loading";
};

Template.AddVideoScreen.linkGrabber = function() {
  return AmplifiedSession.get('linkGrabber');
};

Template.AddVideoScreen.events({
  'click .addVideo' : function () {
    var newUrl = $('#url').val();
    var time = new Date().getTime();

    if (newUrl.indexOf('youtu') != -1) 
      var id = /^.*(?:\/|v=)(.{11})/.exec( newUrl )[ 1 ];
    
    if(id) {
      vid_id = AmplifiedSession.get('videos_id') ? AmplifiedSession.get('videos_id') : Videos.findOne({room_id: AmplifiedSession.get('room_id')})._id;
      Videos.update({ _id: vid_id}, {$inc:{totalVideos:1},
                                     $push:{videoIds: id},
                                     $set:{modified_on: time}}, function (error) {
        if (error) 
          console.log(error);

        if (!AmplifiedSession.equals('mode','submitter')) 
          Meteor.Router.to('/rooms/' + AmplifiedSession.get('room_id'));
        $("#url").val("");
        (function (el) {
            setTimeout(function () {
                el.children().remove('p');
            }, 5000);
        }($('.success').append('<p class="successMessage">Success!</p>')));
      });
    }
  },
  'click .searchMedia' : function() {
    AmplifiedSession.set('linkGrabber', false);
  },
  'click .grabLinks' : function() {
    AmplifiedSession.set('linkGrabber', true);
  },
  'click .searchYoutube' : function() {
    searchVids();
  },
  'click .choose' : function(event) {
    var chosen = event.srcElement.children[1].childNodes[0].data;
    vid_id = AmplifiedSession.get('videos_id') ? AmplifiedSession.get('videos_id') : Videos.findOne({room_id: AmplifiedSession.get('room_id')})._id;
    Videos.update({ _id: vid_id}, {$inc:{totalVideos:1},
                                   $push:{videoIds: chosen}}, function (error) {
      if (error) 
        console.log(error);
      $('#results').html('');
      $('#searchTerms').val('');
      AmplifiedSession.set('adding', false);
    });
  }
});

/////////////////// Create Room ///////////////////

Template.CreateARoom.events({
  'click .save' : function () {
    var newRoomName = $('#name').val();
    var makePrivate = $('#isPrivate').is(':checked');
    Meteor.call("create_room", newRoomName, makePrivate, function(error,room_id) {
      AmplifiedSession.set("room_id", room_id);
      Meteor.call("create_videos", AmplifiedSession.get('room_id'), function(error,videos_id) {
        AmplifiedSession.set("videos_id", videos_id);
        Meteor.Router.to('/rooms/' + AmplifiedSession.get('room_id')  + '/addVideo');
      });
    });
  }
});