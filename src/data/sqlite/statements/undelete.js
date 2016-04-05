// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// ----------------------------------------------------------------------------
var helpers = require('../helpers'),
    format = require('azure-odata-sql').format,
    errors = require('../../../utilities/errors'),
    queries = require('../../../query');

module.exports = function (table, query, version) {
    var tableName = helpers.formatTableName(table.name),
        filterClause = format.filter(queries.toOData(query)),
        undeleteStatement = {
            sql: "UPDATE " + tableName + " SET deleted = 0 WHERE " + filterClause.sql,
            parameters: helpers.mapParameters(filterClause.parameters)
        },
        countStatement = {
            sql: "SELECT changes() AS recordsAffected",
            transform: function (rows) {
                recordsAffected = rows[0].recordsAffected;
            }
        },
        selectStatement = {
            sql: "SELECT * FROM " + tableName + " WHERE " + filterClause.sql,
            parameters: helpers.mapParameters(filterClause.parameters),
            transform: function (rows) {
                var result = helpers.transforms.prepareItems(table)(rows);
                if(recordsAffected === 0) {
                    var error = errors.concurrency('No records were updated');
                    error.item = result;
                    throw error;
                }
                return result;
            }
        },

        recordsAffected;

    if (version) {
        undeleteStatement.sql += " AND [version] = @version";
        undeleteStatement.parameters.version = version;
    }

    return [undeleteStatement, countStatement, selectStatement];
};
