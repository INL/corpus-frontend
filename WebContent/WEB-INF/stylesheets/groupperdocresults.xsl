<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
	<xsl:output method="html" omit-xml-declaration="yes" />
	<xsl:param name="urlparamwithoutstart" select="'#'"/>
	<xsl:param name="urlparamwithoutview" select="'#'"/>
    <xsl:param name="urlparamwithoutvieworgroup" select="'#'"/>
	<xsl:param name="urlparamwithoutsort" select="'#'"/>
    <xsl:param name="query" select="'#'"/>
	
	<xsl:param name="webserviceurl" select="'#'"/>
    <xsl:param name="backendRequestUrl" select="'#'"/>
	<xsl:param name="resultkey" select="'#'"/>
	
	
	
	
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
			<small>Query: <xsl:value-of select="$query" /> - Duration: <xsl:value-of select="search-time" />ms</small>
		</div>
	</xsl:template>
	
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
</xsl:stylesheet>