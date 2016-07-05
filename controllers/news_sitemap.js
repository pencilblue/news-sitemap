/*
	Copyright (C) 2016  PencilBlue, LLC

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU General Public License for more details.

	You should have received a copy of the GNU General Public License
	along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/
'use strict';

//dependencies
var async = require('async');

module.exports = function(pb) {

    //pb dependencies
    var util = pb.util;
    var ArticleServiceV2 = pb.ArticleServiceV2;
    var SiteMapService = pb.SiteMapService;

    /**
     * Google News site-map
     * @class NewsSiteMapController
     * @constructor
     */
    function NewsSiteMapController(){}
    util.inherits(NewsSiteMapController, pb.BaseController);

    /**
     * Initializes the controller
     * @method initSync
     * @param {Object} context
     */
    NewsSiteMapController.prototype.initSync = function(/*context*/) {

        /**
         * @property service
         * @type {ArticleServiceV2}
         */
        this.service = new ArticleServiceV2(this.getServiceContext());
    };

    /**
     * Builds the news feed
     * @method render
     */
    NewsSiteMapController.prototype.render = function(cb) {
        var self = this;

        var options = {
            where: {
                publish_date: {$lte: new Date()}
            },
            select: {
                publish_date: 1,
                headline: 1,
                sub_heading: 1,
                article_topics: 1,
                meta_keywords: 1,
                meta_desc: 1,
                meta_title: 1,
                url: 1
            },
            order: [['publish_date', pb.DAO.DESC]]
        };

        var tasks = [

            util.wrapTask(this.service, this.service.getPublished, [options]),

            function(articles, callback) {
                self.processObjects(articles, callback);
            },

            function(urls, callback) {
                self.ts.registerLocal('urls', new pb.TemplateValue(urls, false));
                self.ts.load('xml_feeds/news_sitemap', callback);
            },

            function(content, callback) {
                var data = {
                    content: content,
                    headers: {
                        'Access-Control-Allow-Origin': '*'
                    }
                };
                callback(null, data);
            }
        ];
        async.waterfall(tasks, function(err, data) {
            cb(err || data);
        });
    };

    /**
     * Handles serializing each individual article
     * @method processObjects
     * @param {Array} objArray
     * @param {Function} cb
     */
    NewsSiteMapController.prototype.processObjects = function(objArray, cb) {
        var self = this;

        var parentTs = self.ts;
        var tasks = util.getTasks(objArray, function(objArray, i) {
            return function(callback) {
                var articleService = new ArticleServiceV2(self.getServiceContext());
                articleService.getMetaInfo(objArray[i], function(err, meta) {
                    if (util.isError(err)) {
                        return callback(err);
                    }
                    var ts = parentTs.getChildInstance();
                    ts.registerLocal('url', '/article/' + objArray[i].url);
                    ts.registerLocal('publish_date', SiteMapService.getLastModDateStr(objArray[i].publish_date));
                    ts.registerLocal('headline', meta.title);
                    ts.registerLocal('keywords', meta.keywords);
                    ts.load('xml_feeds/news_sitemap/url', callback);
                });
            };
        });
        async.parallel(tasks, function(err, results) {
            cb(err, results.join(''));
        });
    };

    /**
     * @static
     * @method getRoutes
     * @param {Function} cb
     */
    NewsSiteMapController.getRoutes = function(cb) {
        var routes = [
            {
                method: 'get',
                path: '/news_sitemap',
                auth_required: false,
                content_type: 'application/xml'
            }
        ];
        cb(null, routes);
    };

    //exports
    return NewsSiteMapController;
};
