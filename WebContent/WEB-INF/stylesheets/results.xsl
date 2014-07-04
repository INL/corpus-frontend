<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
    <xsl:output method="html" omit-xml-declaration="yes" />
    <xsl:param name="urlparamwithoutstart" select="'#'"/>
    <xsl:param name="urlparamwithoutview" select="'#'"/>
    <xsl:param name="urlparamwithoutvieworgroup" select="'#'"/>
    <xsl:param name="urlparamwithoutsort" select="'#'"/>
    <xsl:param name="urlparamquery" select="'#'"/>
    <xsl:param name="query" select="'#'"/>
    
    <xsl:param name="webserviceurl" select="'#'"/>
    <xsl:param name="backendRequestUrl" select="'#'"/>
    <xsl:param name="resultkey" select="'#'"/>
    
    <xsl:param name="pos_name" select="'#'"/>
    <xsl:param name="lemma_name" select="'#'"/>
    <xsl:param name="title_name" select="'#'"/>
    <xsl:param name="author_name" select="'#'"/>
    <xsl:param name="date_name" select="'#'"/>
    <xsl:param name="source_name" select="'#'"/>
    <xsl:param name="groupBy_name" select="'#'"/>
    
    <xsl:template match="error">
        <h1>Error</h1>
        <p><xsl:value-of select="message" /></p>
        <p>(to report this problem and request a, please contact <a href='mailto:servicedesk@inl.nl'>servicedesk@inl.nl</a>)</p>
    </xsl:template>
    
    <xsl:template match="summary">
        <div class="pull-right">
            <small>Query: <xsl:value-of select="$query" /> - Duration: <span id="duration"><xsl:value-of select="search-time" /></span>ms</small>
        </div>
    </xsl:template>
    
    <xsl:template match="doc-infos" />
    
    <xsl:template match="status">
        <div class="span12 contentbox" id="results">
            <div id='waitDisplay' class="alert alert-info">
                Searching, please wait...
                <p class="text-center"><i class="icon-spinner icon-spin xxlarge"></i></p>
            </div>
            <script type="text/javascript">
                var backendRequestUrl = '<xsl:value-of select="$backendRequestUrl" />';
                var checkAgain = <xsl:choose>
                    <xsl:when test="check-again-ms"><xsl:value-of select="check-again-ms" /></xsl:when>
                    <xsl:otherwise>1000</xsl:otherwise>
                </xsl:choose>;
                setTimeout(function () {
                    doResults(backendRequestUrl, checkAgain);
                }, checkAgain);
            </script>
        </div>
    </xsl:template>
    
    <xsl:template match="hits">
        <xsl:variable name="totalHits" select="../summary/number-of-hits" />
        <xsl:variable name="numberOfPages" select="ceiling($totalHits div ../summary/requested-window-size)" />
        <div class="span12 contentbox" id="results">
            <div class="pull-right">
                <small>Total hits: <span id="totalhits">
                    <xsl:call-template name="numberOrWaitingIndicator">
                        <xsl:with-param name="number" select="$totalHits" />
                    </xsl:call-template>
                    </span><br/> Total pages: <span id="totalpages">
                    <xsl:call-template name="numberOrWaitingIndicator">
                        <xsl:with-param name="number" select="$numberOfPages" />
                    </xsl:call-template></span>
                </small>
            </div>
            <ul class="nav nav-tabs" id="contentTabs">
                <li class="active"><a><xsl:attribute name="href"><xsl:value-of select="$urlparamwithoutvieworgroup" /><xsl:value-of select="'view=1'" /></xsl:attribute>Per Hit</a></li>
                <li><a><xsl:attribute name="href"><xsl:value-of select="$urlparamwithoutvieworgroup" /><xsl:value-of select="'view=2'" /></xsl:attribute>Per Document</a></li>
                <li><a><xsl:attribute name="href"><xsl:value-of select="$urlparamwithoutvieworgroup" /><xsl:value-of select="'view=8'" /></xsl:attribute>Hits grouped</a></li>
                <li><a><xsl:attribute name="href"><xsl:value-of select="$urlparamwithoutvieworgroup" /><xsl:value-of select="'view=16'" /></xsl:attribute>Documents grouped</a></li>
            </ul>
            <xsl:call-template name="pagination">
                <xsl:with-param name="totalHits" select="$totalHits" />
                <xsl:with-param name="showToggleTitlesButton" select="true()" />
            </xsl:call-template>
            <div class="tab-pane active lightbg haspadding">
                <table>
                    <thead>
                        <tr class="tbl_head">
                            <th class="tbl_conc_left">
                                <div class="dropdown pull-right">
                                    <a class="dropdown-toggle" data-toggle="dropdown" href="#" id="left">Left context <b class="caret"></b></a>
                                    <ul class="dropdown-menu" role="menu" aria-labelledby="left">
                                        <li><a><xsl:attribute name="href"><xsl:value-of select="$urlparamwithoutsort" /><xsl:value-of select="'sortBy=wordleft'" /></xsl:attribute>Word</a></li>
                                        <li class="disabled"><a><xsl:attribute name="href"><xsl:value-of select="$urlparamwithoutsort" /><xsl:value-of select="'sortBy=wordleft_lemma'" /></xsl:attribute>Lemma</a></li>
                                        <li class="disabled"><a><xsl:attribute name="href"><xsl:value-of select="$urlparamwithoutsort" /><xsl:value-of select="'sortBy=wordleft_pos'" /></xsl:attribute>P.o.S.</a></li>
                                    </ul>
                                </div>
                            </th>
                            <th class="tbl_conc_hit"><a><xsl:attribute name="href"><xsl:value-of select="$urlparamwithoutsort" /><xsl:value-of select="'sortBy=hittext'" /></xsl:attribute>Hit text</a></th>
                            <th class="tbl_conc_right">
                                <div class="dropdown">
                                    <a class="dropdown-toggle" data-toggle="dropdown" href="#" id="right">Right context <b class="caret"></b></a>
                                    <ul class="dropdown-menu" role="menu" aria-labelledby="right">
                                        <li><a><xsl:attribute name="href"><xsl:value-of select="$urlparamwithoutsort" /><xsl:value-of select="'sortBy=wordright'" /></xsl:attribute>Word</a></li>
                                        <li class="disabled"><a><!-- <a><xsl:attribute name="href"><xsl:value-of select="$urlparamwithoutsort" /><xsl:value-of select="'sortBy=wordright_lemma'" /></xsl:attribute>-->Lemma</a></li>
                                        <li class="disabled"><a><!-- <a><xsl:attribute name="href"><xsl:value-of select="$urlparamwithoutsort" /><xsl:value-of select="'sortBy=wordright_pos'" /></xsl:attribute>-->P.o.S.</a></li>
                                    </ul>
                                </div>                          
                            </th>
                            <th class="tbl_lemma"><a><xsl:attribute name="href"><xsl:value-of select="$urlparamwithoutsort" /><xsl:value-of select="'sortBy='" /><xsl:value-of select="$lemma_name" /></xsl:attribute>Lemma</a></th>
                            <th class="tbl_pos"><a><xsl:attribute name="href"><xsl:value-of select="$urlparamwithoutsort" /><xsl:value-of select="'sortBy='" /><xsl:value-of select="$pos_name" /></xsl:attribute>Part of speech</a></th>
                        </tr>
                    </thead>
                    <tbody>
                                    
                    <xsl:for-each select="hit">
                    
                        <xsl:variable name="current_doc" select="doc-pid" />
                        <xsl:variable name="currentId" select="generate-id()" />
                        <xsl:variable name="apos">'</xsl:variable>
                        <xsl:variable name="previous_doc" select="preceding-sibling::hit[1]/doc-pid" />
                        
                        <xsl:if test="$current_doc != $previous_doc or not($previous_doc)">
                            <xsl:variable name="docPid" select="doc-pid/text()" />
                            <xsl:variable name="docInfo" select="/blacklab-response/doc-infos/doc-info[@pid=$docPid]" />
                            <tr class="titlerow">
                                <td colspan="5">
                                    <div class="doctitle collapse in"><a class="text-error" target="_blank"><xsl:attribute name="href"><xsl:value-of select="'article?doc='" /><xsl:value-of select="doc-pid" /><xsl:value-of select="'&amp;query='" /><xsl:value-of select="$urlparamquery" /></xsl:attribute><xsl:value-of select="$docInfo/*[name()=$title_name]" /><xsl:if test="$docInfo/*[name()=$author_name]/text() != ''"> by <xsl:value-of select="$docInfo/*[name()=$author_name]" /></xsl:if><xsl:if test="$docInfo/*[name()=$date_name]/text() != ''"> (<xsl:value-of select="$docInfo/*[name()=$date_name]" />)</xsl:if></a></div>
                                </td>
                            </tr>
                            
                            
                        </xsl:if>
            
                        <tr class="concordance"><xsl:attribute name="onclick">showCitation('#<xsl:value-of select="$currentId" />', '<xsl:value-of select="doc-pid" />', <xsl:value-of select="start" />, <xsl:value-of select="end" />);</xsl:attribute>
                            <td class="tbl_conc_left">...  <xsl:apply-templates select="left" /></td>
                            <td class="tbl_conc_hit"><xsl:value-of select="match" /></td>
                            <td><xsl:value-of select="right" /> ...</td>
                            <td><xsl:value-of select="match/@*[name()=$lemma_name]" /></td>
                            <td><xsl:value-of select="match/@*[name()=$pos_name]" /></td>
                        </tr> 
                        <tr class="citationrow">
                            <td colspan="5">
                                <div class="collapse inline-concordance"><xsl:attribute name="id"><xsl:value-of select="$currentId"/></xsl:attribute>Loading...</div>
                            </td>
                        </tr>
                    </xsl:for-each>

					<xsl:if test="not hit">
					   <tr class="citationrow">   
					       <td colspan="5">
					           <div class="no-results-found">No results were found. Please check your query and try again.</div>
					       </td>
					   </tr>
					</xsl:if>
                    
                    </tbody>
                </table>
            </div>
            <xsl:call-template name="pagination">
                <xsl:with-param name="totalHits" select="$totalHits" />
                <xsl:with-param name="showToggleTitlesButton" select="true()" />
            </xsl:call-template>
        </div>
        <script type="text/javascript">
            var backendRequestUrl = '<xsl:value-of select="$backendRequestUrl" />';
        
            $(document).ready(function() {
                scrollToResults();
                <xsl:if test="$totalHits = -1">
                doStats(backendRequestUrl);
                </xsl:if>
            });

            function showCitation(element, docPid, start, end) {
                $(element).collapse('toggle');
                var retriever = new AjaxRetriever('<xsl:value-of select="$webserviceurl" />', 'docs/' + docPid + '/snippet');
                var param = {
                    outputformat: "xml",
                    hitstart: start,
                    hitend: end,
                    wordsaroundhit: 50
                };
                retriever.putAjaxResponse(element, param, false, "../js/concordance.xsl");
            }
        </script>
    </xsl:template>
    
    <xsl:template match="docs">
        <xsl:variable name="totalHits" select="../summary/number-of-docs" />
        <xsl:variable name="numberOfPages" select="ceiling($totalHits div ../summary/requested-window-size)" />
        <div class="span12 contentbox" id="results">
            <div class="pull-right">
                <small>Total documents: <span id="totalhits">
                    <xsl:call-template name="numberOrWaitingIndicator">
                        <xsl:with-param name="number" select="$totalHits" />
                    </xsl:call-template>
                    </span><br/> Total pages: <span id="totalpages">
                    <xsl:call-template name="numberOrWaitingIndicator">
                        <xsl:with-param name="number" select="$numberOfPages" />
                    </xsl:call-template></span>
                </small>
            </div>
            <ul class="nav nav-tabs" id="contentTabs">
                <li><a><xsl:attribute name="href"><xsl:value-of select="$urlparamwithoutvieworgroup" /><xsl:value-of select="'view=1'" /></xsl:attribute>Per Hit</a></li>
                <li class="active"><a><xsl:attribute name="href"><xsl:value-of select="$urlparamwithoutvieworgroup" /><xsl:value-of select="'view=2'" /></xsl:attribute>Per Document</a></li>
                <li><a><xsl:attribute name="href"><xsl:value-of select="$urlparamwithoutvieworgroup" /><xsl:value-of select="'view=8'" /></xsl:attribute>Hits grouped</a></li>
                <li><a><xsl:attribute name="href"><xsl:value-of select="$urlparamwithoutvieworgroup" /><xsl:value-of select="'view=16'" /></xsl:attribute>Documents grouped</a></li>
            </ul>
            <xsl:call-template name="pagination">
                <xsl:with-param name="totalHits" select="$totalHits" />
                <xsl:with-param name="showToggleTitlesButton" select="false()" />
            </xsl:call-template>
            <div class="tab-pane active lightbg haspadding">
                <table class="documents">
                    <thead>
                        <tr class="tbl_head">
                            <th class="tbl_doct"><a><xsl:attribute name="href"><xsl:value-of select="$urlparamwithoutsort" /><xsl:value-of select="'sortBy='" /><xsl:value-of select="$title_name" /></xsl:attribute>Document title</a></th>
                            <th class="tbl_year"><a><xsl:attribute name="href"><xsl:value-of select="$urlparamwithoutsort" /><xsl:value-of select="'sortBy='" /><xsl:value-of select="$date_name" /></xsl:attribute>Year</a></th>
                            <th class="tbl_hits"><a><xsl:attribute name="href"><xsl:value-of select="$urlparamwithoutsort" /><xsl:value-of select="'sortBy=size'" /></xsl:attribute>Hits</a></th>
                        </tr>
                    </thead>
                    <tbody>     
                    <xsl:for-each select="doc">                     
                        <tr>
                            <td>
                                <a target="_blank"><xsl:attribute name="href"><xsl:value-of select="'article?doc='" /><xsl:value-of select="doc-pid" /><xsl:value-of select="'&amp;query='" /><xsl:value-of select="$urlparamquery" /></xsl:attribute><xsl:value-of select="doc-info/*[name()=$title_name]" /><xsl:if test="doc-info/*[name()=$author_name]/text() != ''"> by <xsl:value-of select="doc-info/*[name()=$author_name]" /></xsl:if></a><br/>
                                ... <xsl:value-of select="snippets/snippet[1]/left" />&#160;<strong><xsl:value-of select="snippets/snippet[1]/match" /></strong>&#160;<xsl:value-of select="snippets/snippet[1]/right" /> ...<br/>
                                <div class="collapse"><xsl:attribute name="id"><xsl:value-of select="doc-pid" /></xsl:attribute>
                                <xsl:for-each select="snippets/snippet">
                                    ... <xsl:value-of select="left" />&#160;<strong><xsl:value-of select="match" /></strong>&#160;<xsl:value-of select="right" /> ...<br/>
                                </xsl:for-each>
                                <em>...</em>
                                </div>
                                <a class="btn btn-mini green" target="_blank"><xsl:attribute name="href"><xsl:value-of select="'article?doc='" /><xsl:value-of select="doc-pid" /><xsl:value-of select="'&amp;query='" /><xsl:value-of select="$urlparamquery" /></xsl:attribute>View document info</a>                                     
                            </td>
                            <td>
                                <xsl:value-of select="doc-info/*[name()=$date_name]" />
                            </td>
                            <td>
                                <xsl:value-of select="number-of-hits" />
                            </td>
                        </tr>
                    </xsl:for-each>
                    
					<xsl:if test="not doc">
					   <tr class="citationrow">   
					       <td colspan="5">
					           <div class="no-results-found">No results were found. Please check your query and try again.</div>
					       </td>
					   </tr>
					</xsl:if>
                    
                    </tbody>
                </table>
            </div>
            <xsl:call-template name="pagination">
                <xsl:with-param name="totalHits" select="$totalHits" />
                <xsl:with-param name="showToggleTitlesButton" select="false()" />
            </xsl:call-template>
        </div>
        <script type="text/javascript">
            var backendRequestUrl = '<xsl:value-of select="$backendRequestUrl" />';
            
            $(document).ready(function() {
                scrollToResults();
                <xsl:if test="$totalHits = -1">
                doStats(backendRequestUrl);
                </xsl:if>
            });
        </script>
    </xsl:template>
    
    <xsl:template match="hitgroups">
        <div class="span12 contentbox" id="results">
            <ul class="nav nav-tabs" id="contentTabs">
                <li><a><xsl:attribute name="href"><xsl:value-of select="$urlparamwithoutvieworgroup" /><xsl:value-of select="'view=1'" /></xsl:attribute>Per Hit</a></li>
                <li><a><xsl:attribute name="href"><xsl:value-of select="$urlparamwithoutvieworgroup" /><xsl:value-of select="'view=2'" /></xsl:attribute>Per Document</a></li>
                <li class="active"><a><xsl:attribute name="href"><xsl:value-of select="$urlparamwithoutvieworgroup" /><xsl:value-of select="'view=8'" /></xsl:attribute>Hits grouped</a></li>
                <li><a><xsl:attribute name="href"><xsl:value-of select="$urlparamwithoutvieworgroup" /><xsl:value-of select="'view=16'" /></xsl:attribute>Documents grouped</a></li>
            </ul>
            <select class="input" name="groupBy" onchange="document.searchform.submit();">
                <option value="" disabled="true"><xsl:if test="'' = $groupBy_name"><xsl:attribute name="selected"><xsl:value-of select="'true'" /></xsl:attribute></xsl:if>Group hits by...</option>
                <xsl:variable name="sortByTitleValue">field:<xsl:value-of select="$title_name" /></xsl:variable>
                <option><xsl:attribute name="value"><xsl:value-of select="$sortByTitleValue" /></xsl:attribute><xsl:if test="$sortByTitleValue = $groupBy_name"><xsl:attribute name="selected"><xsl:value-of select="'true'" /></xsl:attribute></xsl:if>Group by document title</option>
                <option value="hit"><xsl:if test="'hit' = $groupBy_name"><xsl:attribute name="selected"><xsl:value-of select="'true'" /></xsl:attribute></xsl:if>Group by hit text</option>
                <option><xsl:attribute name="value">hit:<xsl:value-of select="$lemma_name" /></xsl:attribute><xsl:if test="$lemma_name = $groupBy_name"><xsl:attribute name="selected"><xsl:value-of select="'true'" /></xsl:attribute></xsl:if>Group by lemma</option>
                <option><xsl:attribute name="value">hit:<xsl:value-of select="$pos_name" /></xsl:attribute><xsl:if test="$pos_name = $groupBy_name"><xsl:attribute name="selected"><xsl:value-of select="'true'" /></xsl:attribute></xsl:if>Group by hit pos</option>
                <option value="hit:lemma,hit:pos"><xsl:if test="'hit:lemma,hit:pos' = $groupBy_name"><xsl:attribute name="selected"><xsl:value-of select="'true'" /></xsl:attribute></xsl:if>Group by lemma and PoS</option>
                <option value="wordleft"><xsl:if test="'wordleft' = $groupBy_name"><xsl:attribute name="selected"><xsl:value-of select="'true'" /></xsl:attribute></xsl:if>Group by word left</option>
                <option value="wordright"><xsl:if test="'wordright' = $groupBy_name"><xsl:attribute name="selected"><xsl:value-of select="'true'" /></xsl:attribute></xsl:if>Group by word right</option>
                <option><xsl:attribute name="value">field:<xsl:value-of select="$date_name" /></xsl:attribute><xsl:if test="$date_name = $groupBy_name"><xsl:attribute name="selected"><xsl:value-of select="'true'" /></xsl:attribute></xsl:if>Group by year</option>
                <option><xsl:attribute name="value">field:<xsl:value-of select="$date_name" /></xsl:attribute><xsl:attribute name="disabled">true</xsl:attribute><xsl:if test="'decade' = $groupBy_name"><xsl:attribute name="selected"><xsl:value-of select="'true'" /></xsl:attribute></xsl:if>Group by decade</option>
            </select> 
            <div class="tab-pane active lightbg haspadding">
                <table>
                    <thead>
                        <tr>
                            <th class="tbl_groupname"><a><xsl:attribute name="href"><xsl:value-of select="$urlparamwithoutsort" /><xsl:value-of select="'sortBy=title'" /></xsl:attribute>Group</a></th>
                            <th><a><xsl:attribute name="href"><xsl:value-of select="$urlparamwithoutsort" /><xsl:value-of select="'sortBy=size'" /></xsl:attribute>Hits</a></th>
                        </tr>
                    </thead>
                    <tbody>     
                    <xsl:for-each select="hitgroup">    
                        <xsl:variable name="width" select="size * 100 div /blacklab-response/summary/largest-group-size" />
                        <xsl:variable name="rowId" select="generate-id()"/>
                        <xsl:variable name="apos">'</xsl:variable>
                        <tr>
                            <td><xsl:value-of select="identity-display"/></td>
                            <td>
                                <div class="progress progress-success" data-toggle="collapse"><xsl:attribute name="data-target"><xsl:value-of select="'.'"/><xsl:value-of select="$rowId"/></xsl:attribute>
                                    <div class="bar"><xsl:attribute name="style"><xsl:value-of select="'width: '"/><xsl:value-of select="$width"/><xsl:value-of select="'%;'"/></xsl:attribute><xsl:value-of select="size"/></div>
                                </div>
                                <div><xsl:attribute name="class"><xsl:value-of select="$rowId"/><xsl:value-of select="' collapse groupcontent'"></xsl:value-of></xsl:attribute><xsl:attribute name="id"><xsl:value-of select="$rowId"/></xsl:attribute><xsl:attribute name="data-group"><xsl:value-of select="identity"/></xsl:attribute>
                                    <div class="inline-concordance">
                                        <a class="btn btn-link"><xsl:attribute name="href"><xsl:value-of select="$urlparamwithoutvieworgroup" /><xsl:value-of select="'view=1'" /><xsl:value-of select="'&#38;viewGroup='" /><xsl:value-of select="identity"/><xsl:value-of select="'&#38;groupBy='" /><xsl:value-of select="$groupBy_name"/></xsl:attribute>&#171; View detailed concordances in this group</a> - <button class="btn btn-link nolink"><xsl:attribute name="onclick"><xsl:value-of select="'getGroupContent('"/><xsl:value-of select="$apos"/><xsl:value-of select="'#'"/><xsl:value-of select="$rowId"/><xsl:value-of select="$apos"/><xsl:value-of select="');'"/></xsl:attribute>Load more concordances...</button> 
                                    </div>
                                </div>
                            </td>
                        </tr>                   
                    </xsl:for-each>
                    
					<xsl:if test="not hitgroup">
					   <tr class="citationrow">   
					       <td colspan="5">
					           <div class="no-results-found">No results were found. Please check your query and try again.</div>
					       </td>
					   </tr>
					</xsl:if>
                    
                    </tbody>
                </table>
            </div>
        </div>
        <script>
        var backendRequestUrl = '<xsl:value-of select="$backendRequestUrl" />';
            
        $(document).ready(function() {
            scrollToResults();
            $('.nolink').click(function(event) { event.preventDefault();});
            $('.groupcontent').on('show', function() { checkIfFirstTimeOpen('#' + $(this).attr('id'));});
        });
        
        function checkIfFirstTimeOpen(element) {
            if(ar_loadFrom[element] == null) 
                getGroupContent(element);
        }
        
        function getGroupContent(element) {             
            var start = 0;
            
            if(ar_loadFrom[element] != null)
                var start = ar_loadFrom[element];
                
            var retriever = new AjaxRetriever(backendRequestUrl, '');
            var groupid = decodeURIComponent($(element).attr('data-group'));
            retriever.putAjaxResponse(element, {
                viewgroup: groupid,
                first: start
            }, true, "../js/hitgroup.xsl");
            
            ar_loadFrom[element] = start + 20;
            
            return false;
        }
        
        var ar_loadFrom = [];
        </script>
    </xsl:template>
    
    <xsl:template match="docgroups">
        <div class="span12 contentbox" id="results">
            <ul class="nav nav-tabs" id="contentTabs">
                <li><a><xsl:attribute name="href"><xsl:value-of select="$urlparamwithoutvieworgroup" /><xsl:value-of select="'view=1'" /></xsl:attribute>Per Hit</a></li>
                <li><a><xsl:attribute name="href"><xsl:value-of select="$urlparamwithoutvieworgroup" /><xsl:value-of select="'view=2'" /></xsl:attribute>Per Document</a></li>
                <li><a><xsl:attribute name="href"><xsl:value-of select="$urlparamwithoutvieworgroup" /><xsl:value-of select="'view=8'" /></xsl:attribute>Hits grouped</a></li>
                <li class="active"><a><xsl:attribute name="href"><xsl:value-of select="$urlparamwithoutvieworgroup" /><xsl:value-of select="'view=16'" /></xsl:attribute>Documents grouped</a></li>
            </ul>
            <select class="input" name="groupBy" onchange="document.searchform.submit();">
                <option value="" disabled="true"><xsl:if test="'' = $groupBy_name"><xsl:attribute name="selected"><xsl:value-of select="'true'" /></xsl:attribute></xsl:if>Group documents by...</option>
                <option value="numhits"><xsl:if test="'numhits' = $groupBy_name"><xsl:attribute name="selected"><xsl:value-of select="'true'" /></xsl:attribute></xsl:if>Group by number of hits</option>
                <xsl:variable name="sortByDateValue">field:<xsl:value-of select="$date_name" /></xsl:variable>
                <option><xsl:attribute name="value"><xsl:value-of select="$sortByDateValue" /></xsl:attribute><xsl:if test="$sortByDateValue = $groupBy_name"><xsl:attribute name="selected"><xsl:value-of select="'true'" /></xsl:attribute></xsl:if>Group by year</option>
                <xsl:variable name="sortByDecadeValue">decade:<xsl:value-of select="$date_name" /></xsl:variable>
                <option><xsl:attribute name="value"><xsl:value-of select="$sortByDecadeValue" /></xsl:attribute><xsl:attribute name="disabled">true</xsl:attribute><xsl:if test="$sortByDecadeValue = $groupBy_name"><xsl:attribute name="selected"><xsl:value-of select="'true'" /></xsl:attribute></xsl:if>Group by decade</option>
                <xsl:variable name="sortByAuthorValue">field:<xsl:value-of select="$author_name" /></xsl:variable>
                <option><xsl:attribute name="value"><xsl:value-of select="$sortByAuthorValue" /></xsl:attribute><xsl:if test="$sortByAuthorValue = $groupBy_name"><xsl:attribute name="selected"><xsl:value-of select="'true'" /></xsl:attribute></xsl:if>Group by author</option>
            </select> 
            <div class="tab-pane active lightbg haspadding">
                <table>
                    <thead>
                        <tr>
                            <th class="tbl_groupname"><a><xsl:attribute name="href"><xsl:value-of select="$urlparamwithoutsort" /><xsl:value-of select="'sortBy=title'" /></xsl:attribute>Group</a></th>
                            <th><a><xsl:attribute name="href"><xsl:value-of select="$urlparamwithoutsort" /><xsl:value-of select="'sortBy=size'" /></xsl:attribute>Hits</a></th>
                        </tr>
                    </thead>
                    <tbody>     
                    <xsl:for-each select="docgroup">    
                        <xsl:variable name="width" select="size * 100 div /blacklab-response/summary/largest-group-size" />
                        <xsl:variable name="rowId" select="generate-id()"/>
                        <xsl:variable name="apos">'</xsl:variable>
                        <tr>
                            <td><xsl:value-of select="identity-display"/></td>
                            <td>
                                <div class="progress progress-warning" data-toggle="collapse"><xsl:attribute name="data-target"><xsl:value-of select="'.'"/><xsl:value-of select="$rowId"/></xsl:attribute>
                                    <div class="bar"><xsl:attribute name="style"><xsl:value-of select="'width: '"/><xsl:value-of select="$width"/><xsl:value-of select="'%;'"/></xsl:attribute><xsl:value-of select="size"/></div>
                                </div>
                                <div><xsl:attribute name="class"><xsl:value-of select="$rowId"/><xsl:value-of select="' collapse groupcontent'"></xsl:value-of></xsl:attribute><xsl:attribute name="id"><xsl:value-of select="$rowId"/></xsl:attribute><xsl:attribute name="data-group"><xsl:value-of select="identity"/></xsl:attribute>
                                    <div class="inline-concordance">
                                        <a class="btn btn-link"><xsl:attribute name="href"><xsl:value-of select="$urlparamwithoutvieworgroup" /><xsl:value-of select="'view=2'" /><xsl:value-of select="'&#38;viewGroup='" /><xsl:value-of select="identity"/><xsl:value-of select="'&#38;groupBy='" /><xsl:value-of select="$groupBy_name"/></xsl:attribute>&#171; View detailed docs in this group</a> - <button class="btn btn-link nolink"><xsl:attribute name="onclick"><xsl:value-of select="'getGroupContent('"/><xsl:value-of select="$apos"/><xsl:value-of select="'#'"/><xsl:value-of select="$rowId"/><xsl:value-of select="$apos"/><xsl:value-of select="');'"/></xsl:attribute>Load more docs...</button> 
                                    </div>
                                
                                </div>
                            </td>
                        </tr>                   
                    </xsl:for-each>
                    
					<xsl:if test="not docgroup">
					   <tr class="citationrow">   
					       <td colspan="5">
					           <div class="no-results-found">No results were found. Please check your query and try again.</div>
					       </td>
					   </tr>
					</xsl:if>
                    
                    </tbody>
                </table>
            </div>
        </div>
        <script>
        var backendRequestUrl = '<xsl:value-of select="$backendRequestUrl" />';
            
        $(document).ready(function() {
            scrollToResults();
            $('.nolink').click(function(event) { event.preventDefault();});
            $('.groupcontent').on('show', function() { checkIfFirstTimeOpen('#' + $(this).attr('id'));});
        });
        
        function checkIfFirstTimeOpen(element) {
            if(ar_loadFrom[element] == null) 
                getGroupContent(element);
        }
        
        function getGroupContent(element) {
            var start = 0;
            
            if(ar_loadFrom[element] != null)
                var start = ar_loadFrom[element];
                
            var retriever = new AjaxRetriever(backendRequestUrl, '');
            var groupid = decodeURIComponent($(element).attr('data-group'));
            retriever.putAjaxResponse(element, {
                viewgroup: groupid,
                first: start
            }, true, "../js/docgroup.xsl");
            
            ar_loadFrom[element] = start + 20;
            
            return false;
        }
        
        var ar_loadFrom = [];
        </script>
    </xsl:template>
    
    <xsl:template name="pagination">
        <xsl:param name="totalHits" />
        <xsl:param name="showToggleTitlesButton" />
        <xsl:variable name="resultsPerPage" select="../summary/requested-window-size" />
        <xsl:variable name="startResults" select="../summary/window-first-result" />
        <xsl:variable name="currentPage" select="floor( $startResults div $resultsPerPage ) + 1" />
        <xsl:variable name="numberOfPages" select="ceiling($totalHits div $resultsPerPage)" />
        <xsl:variable name="startPage">
            <xsl:call-template name="max">
                <xsl:with-param name="num1" select="$currentPage - 10"/>
                <xsl:with-param name="num2" select="1"/>
            </xsl:call-template>
        </xsl:variable>
        <xsl:variable name="total">
            <xsl:call-template name="min">
                <xsl:with-param name="num1" select="$currentPage + 10"/>
                <xsl:with-param name="num2" select="$numberOfPages"/>
            </xsl:call-template>
        </xsl:variable>
        <div class="pagination">
        <ul class="pagebuttons">
            <xsl:choose>
                <xsl:when test="$currentPage = 1">
                    <li class="disabled"><a href="#">Prev</a></li>
                </xsl:when>
                <xsl:otherwise>
                    <li><a><xsl:attribute name="href"><xsl:value-of select="$urlparamwithoutstart" /><xsl:value-of select="'start='" /><xsl:value-of select="($currentPage - 2) * $resultsPerPage" /></xsl:attribute>Prev</a></li>
                </xsl:otherwise>
            </xsl:choose>
            <xsl:if test="$startPage &gt; 1">
                <li class="disabled"><a href="#">...</a></li>
            </xsl:if>
            <xsl:call-template name="makePagination">
                <xsl:with-param name="active" select="$currentPage" />
                <xsl:with-param name="total" select="$total" />
                <xsl:with-param name="start" select="$startPage" />
                <xsl:with-param name="perpage" select="$resultsPerPage" />
            </xsl:call-template>
            <xsl:if test="$total &lt; $numberOfPages">
                <li class="disabled"><a href="#">...</a></li>
            </xsl:if>
            <xsl:choose>
                <xsl:when test="$currentPage = $numberOfPages">
                    <li class="disabled"><a href="#">Next</a></li>
                </xsl:when>
                <xsl:otherwise>
                    <li><a><xsl:attribute name="href"><xsl:value-of select="$urlparamwithoutstart" /><xsl:value-of select="'start='" /><xsl:value-of select="($currentPage * $resultsPerPage)" /></xsl:attribute>Next</a></li>
                </xsl:otherwise>
            </xsl:choose>
        </ul>
        <xsl:if test="$showToggleTitlesButton">
        <button type="button" class="btn btn-small btn-danger" data-toggle="collapse" data-target=".doctitle" style="vertical-align: top; margin-top: 2px;">Show/hide titles</button>
        </xsl:if>
        </div>
    </xsl:template>
    
    <xsl:template name="makePagination">
        <xsl:param name="active" />
        <xsl:param name="total" />
        <xsl:param name="start" />
        <xsl:param name="perpage" />
        
        <xsl:choose>
            <xsl:when test="$start = $active">
                <li class="active"><a href="#"><xsl:value-of select="$start" /></a></li>
            </xsl:when>
            <xsl:otherwise>
                <li><a><xsl:attribute name="href"><xsl:value-of select="$urlparamwithoutstart" /><xsl:value-of select="'start='" /><xsl:value-of select="($start - 1) * $perpage" /></xsl:attribute><xsl:value-of select="$start" /></a></li>
            </xsl:otherwise>
        </xsl:choose>
        
        <xsl:if test="$start &lt; $total">
            <xsl:call-template name="makePagination">
                <xsl:with-param name="active" select="$active" />
                <xsl:with-param name="total" select="$total" />
                <xsl:with-param name="perpage" select="$perpage" />
                <xsl:with-param name="start" select="($start + 1)" />
            </xsl:call-template>
        </xsl:if>
    </xsl:template>
    
    <xsl:template name="max">
        <xsl:param name="num1"/>
        <xsl:param name="num2"/>
        <xsl:choose>
            <xsl:when test="$num1 &gt; $num2">
                <xsl:value-of select="$num1" />
            </xsl:when>
            <xsl:otherwise>
                <xsl:value-of select="$num2" />
            </xsl:otherwise>
        </xsl:choose>
    </xsl:template>
    
    <xsl:template name="min">
        <xsl:param name="num1"/>
        <xsl:param name="num2"/>
        <xsl:choose>
            <xsl:when test="$num1 &lt; $num2">
                <xsl:value-of select="$num1" />
            </xsl:when>
            <xsl:otherwise>
                <xsl:value-of select="$num2" />
            </xsl:otherwise>
        </xsl:choose>
    </xsl:template>
    
    <xsl:template name="numberOrWaitingIndicator">
        <xsl:param name="number" />
        
        <xsl:choose>
            <xsl:when test="$number &lt; 0">
                <i class="icon-spinner icon-spin"></i>
            </xsl:when>
            <xsl:otherwise>
                <xsl:value-of select="$number" />
            </xsl:otherwise>
        </xsl:choose>
    </xsl:template>
    
</xsl:stylesheet>