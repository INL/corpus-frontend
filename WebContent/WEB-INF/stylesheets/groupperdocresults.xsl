<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
	<xsl:output method="html" omit-xml-declaration="yes" />
	<xsl:param name="urlparamwithoutstart" select="'#'"/>
	<xsl:param name="urlparamwithoutview" select="'#'"/>
	<xsl:param name="urlparamwithoutsort" select="'#'"/>
	<xsl:param name="urlparamwithoutvieworgroup" select="'#'"/>
	
	<xsl:param name="webserviceurl" select="'#'"/>
	<xsl:param name="resultkey" select="'#'"/>
	
	<xsl:param name="author_name" select="'#'"/>
	<xsl:param name="date_name" select="'#'"/>
	<xsl:param name="source_name" select="'#'"/>
	<xsl:param name="groupBy_name" select="'#'"/>
	
	<xsl:template match="error">
		<h1>Error</h1>
		<xsl:value-of select="." />
	</xsl:template>
	
	<xsl:template match="SearchSummary">
		<div class="pull-right">
			<small>Query: <xsl:value-of select="Query" /> - Duration: <xsl:value-of select="Duration" />ms</small>
		</div>
	</xsl:template>
	
	<xsl:template match="PerDocGroupResults">
		<div class="span12 contentbox" id="results">
			<ul class="nav nav-tabs" id="contentTabs">
				<li><a><xsl:attribute name="href"><xsl:value-of select="$urlparamwithoutvieworgroup" /><xsl:value-of select="'view=1'" /></xsl:attribute>Per Hit</a></li>
				<li><a><xsl:attribute name="href"><xsl:value-of select="$urlparamwithoutvieworgroup" /><xsl:value-of select="'view=2'" /></xsl:attribute>Per Document</a></li>
				<li><a><xsl:attribute name="href"><xsl:value-of select="$urlparamwithoutvieworgroup" /><xsl:value-of select="'view=8'" /></xsl:attribute>Hits grouped</a></li>
				<li class="active"><a><xsl:attribute name="href"><xsl:value-of select="$urlparamwithoutvieworgroup" /><xsl:value-of select="'view=16'" /></xsl:attribute>Documents grouped</a></li>
			</ul>
			<select class="input" name="groupBy" onchange="document.searchform.submit();">
				<option value="" disabled="true" selected="true">Group documents by...</option>
				<option value="hits"><xsl:if test="'hits' = $groupBy_name"><xsl:attribute name="selected"><xsl:value-of select="'true'" /></xsl:attribute></xsl:if>Group by number of hits</option>
				<option><xsl:attribute name="value"><xsl:value-of select="$date_name" /></xsl:attribute><xsl:if test="$date_name = $groupBy_name"><xsl:attribute name="selected"><xsl:value-of select="'true'" /></xsl:attribute></xsl:if>Group by year</option>
				<option value="decade" disabled="true"><xsl:if test="'decade' = $groupBy_name"><xsl:attribute name="selected"><xsl:value-of select="'true'" /></xsl:attribute></xsl:if>Group by decade</option>
				<option><xsl:attribute name="value"><xsl:value-of select="$author_name" /></xsl:attribute><xsl:if test="$author_name = $groupBy_name"><xsl:attribute name="selected"><xsl:value-of select="'true'" /></xsl:attribute></xsl:if>Group by author</option>
			</select> 
			<div class="tab-pane active lightbg haspadding">
				<table>
					<thead>
						<tr>
							<th class="tbl_groupname"><a><xsl:attribute name="href"><xsl:value-of select="$urlparamwithoutsort" /><xsl:value-of select="'sortBy=title'" /></xsl:attribute>Group</a></th>
							<th><a><xsl:attribute name="href"><xsl:value-of select="$urlparamwithoutsort" /><xsl:value-of select="'sortBy=hits'" /></xsl:attribute>Hits</a></th>
						</tr>
					</thead>
					<tbody>		
					<xsl:for-each select="Group">	
						<xsl:variable name="width" select="Perm div 10" />
						<xsl:variable name="rowId" select="generate-id()"/>
						<xsl:variable name="apos">'</xsl:variable>
						<tr>
							<td><xsl:value-of select="GroupName"/></td>
							<td>
								<div class="progress progress-warning" data-toggle="collapse"><xsl:attribute name="data-target"><xsl:value-of select="'.'"/><xsl:value-of select="$rowId"/></xsl:attribute>
									<div class="bar"><xsl:attribute name="style"><xsl:value-of select="'width: '"/><xsl:value-of select="$width"/><xsl:value-of select="'%;'"/></xsl:attribute><xsl:value-of select="Freq"/></div>
								</div>
								<div><xsl:attribute name="class"><xsl:value-of select="$rowId"/><xsl:value-of select="' collapse groupcontent'"></xsl:value-of></xsl:attribute><xsl:attribute name="id"><xsl:value-of select="$rowId"/></xsl:attribute><xsl:attribute name="data-group"><xsl:value-of select="GroupId"/></xsl:attribute>
									<div class="inline-concordance">
										<a class="btn btn-link"><xsl:attribute name="href"><xsl:value-of select="$urlparamwithoutvieworgroup" /><xsl:value-of select="'view=2'" /><xsl:value-of select="'&#38;viewGroup='" /><xsl:value-of select="GroupId"/><xsl:value-of select="'&#38;groupBy='" /><xsl:value-of select="$groupBy_name"/></xsl:attribute>&#171; View detailed docs in this group</a> - <button class="btn btn-link nolink"><xsl:attribute name="onclick"><xsl:value-of select="'getGroupContent('"/><xsl:value-of select="$apos"/><xsl:value-of select="'#'"/><xsl:value-of select="$rowId"/><xsl:value-of select="$apos"/><xsl:value-of select="');'"/></xsl:attribute>Load more docs...</button> 
									</div>
								
								</div>
							</td>
						</tr>					
					</xsl:for-each>
					</tbody>
				</table>
			</div>
		</div>
		<script>$(document).ready(function() {
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
				
			var retriever = new AjaxRetriever('<xsl:value-of select="$webserviceurl" />', 'group');
			var groupid = decodeURIComponent($(element).attr('data-group'));
			retriever.putAjaxResponse(element, {id: '<xsl:value-of select="$resultkey" />', groupId: groupid, start: start}, true, "../js/docgroup.xsl");
			
			ar_loadFrom[element] = start + 20;
			
			return false;
		}
		
		var ar_loadFrom = [];
		
		</script>
	</xsl:template>
</xsl:stylesheet>