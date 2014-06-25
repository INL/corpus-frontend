<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
	<xsl:output method="html" omit-xml-declaration="yes" />
	<xsl:param name="urlparamwithoutstart" select="'#'"/>
	<xsl:param name="urlparamwithoutsort" select="'#'"/>
	<xsl:param name="urlparamwithoutvieworgroup" select="'#'"/>
	<xsl:param name="urlparamquery" select="'#'"/>
	
	<xsl:param name="title_name" select="'#'"/>
	<xsl:param name="author_name" select="'#'"/>
	<xsl:param name="date_name" select="'#'"/>
	<xsl:param name="source_name" select="'#'"/>
	
	<xsl:param name="webserviceurl" select="'#'"/>
	<xsl:param name="resultkey" select="'#'"/>
	
	<xsl:template match="error">
		<h1>Error</h1>
		<xsl:value-of select="." />
	</xsl:template>
	
	<xsl:template match="SearchSummary">
		<div class="pull-right">
			<small>Query: <xsl:value-of select="Query" /> - Duration: <span id="duration"><xsl:value-of select="Duration" /></span>ms</small>
		</div>
	</xsl:template>
	
	<xsl:template match="PerDocumentResults">
		<xsl:variable name="totalHits" select="TotalDocs" />
		<xsl:variable name="numberOfPages" select="ceiling($totalHits div MaxDocsPerPage)" />
		<div class="span12 contentbox" id="results">
			<div class="pull-right">
				<small>Total documents: <span id="totalhits">
					<xsl:call-template name="numberOrWaitingIndidcator">
						<xsl:with-param name="number" select="$totalHits" />
					</xsl:call-template>
					</span><br/> Total pages: <span id="totalpages">
					<xsl:call-template name="numberOrWaitingIndidcator">
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
			<xsl:call-template name="pagination" />
			<div class="tab-pane active lightbg haspadding">
				<table class="documents">
					<thead>
						<tr class="tbl_head">
							<th class="tbl_doct"><a><xsl:attribute name="href"><xsl:value-of select="$urlparamwithoutsort" /><xsl:value-of select="'sortBy='" /><xsl:value-of select="$title_name" /></xsl:attribute>Document title</a></th>
							<th class="tbl_year"><a><xsl:attribute name="href"><xsl:value-of select="$urlparamwithoutsort" /><xsl:value-of select="'sortBy='" /><xsl:value-of select="$date_name" /></xsl:attribute>Year</a></th>
							<th class="tbl_hits"><a><xsl:attribute name="href"><xsl:value-of select="$urlparamwithoutsort" /><xsl:value-of select="'sortBy=hits'" /></xsl:attribute>Hits</a></th>
						</tr>
					</thead>
					<tbody>		
					<xsl:for-each select="Documents/Document">						
						<tr>
							<td>
								<a target="_blank"><xsl:attribute name="href"><xsl:value-of select="'article?doc='" /><xsl:value-of select="DocId" /><xsl:value-of select="'&amp;query='" /><xsl:value-of select="$urlparamquery" /></xsl:attribute><xsl:value-of select="*[name()=$title_name]" /><xsl:if test="*[name()=$author_name]/text() != ''"> by <xsl:value-of select="*[name()=$author_name]" /></xsl:if></a><br/>
								... <xsl:value-of select="Concordances/Concordance[1]/ConcLeft" />&#160;<strong><xsl:value-of select="Concordances/Concordance[1]/ConcHit" /></strong>&#160;<xsl:value-of select="Concordances/Concordance[1]/ConcRight" /> ...<br/>
								<div class="collapse"><xsl:attribute name="id"><xsl:value-of select="DocId" /></xsl:attribute>
								<xsl:for-each select="Concordances/Concordance">
									... <xsl:value-of select="ConcLeft" />&#160;<strong><xsl:value-of select="ConcHit" /></strong>&#160;<xsl:value-of select="ConcRight" /> ...<br/>
								</xsl:for-each>
								<em>...</em>
								</div>
								<a class="btn btn-mini green" target="_blank"><xsl:attribute name="href"><xsl:value-of select="'article?doc='" /><xsl:value-of select="DocId" /><xsl:value-of select="'&amp;query='" /><xsl:value-of select="$urlparamquery" /></xsl:attribute>View document info</a> <!-- <a class="btn btn-mini green" data-toggle="collapse"><xsl:attribute name="data-target"><xsl:value-of select="'#'" /><xsl:value-of select="DocId" /></xsl:attribute>Show more concordances...</a>-->										
							</td>
							<td>
								<xsl:value-of select="*[name()=$date_name]" />
							</td>
							<td>
								<xsl:value-of select="HitsInDoc" />
							</td>
						</tr>
					</xsl:for-each>
					</tbody>
				</table>
			</div>
			<xsl:call-template name="pagination" />
		</div>
		<script type="text/javascript">
			$(document).ready(function() {
				scrollToResults();
				<xsl:if test="$totalHits = -1">
				doStats('<xsl:value-of select="$webserviceurl" />', '<xsl:value-of select="$resultkey" />');
				</xsl:if>
				});
		</script>
	</xsl:template>
	
	<xsl:template name="pagination">
		<div class="pagination">
		<xsl:variable name="resultsPerPage" select="MaxDocsPerPage" />
		<xsl:variable name="totalHits" select="TotalDocs" />
		<xsl:variable name="startResults" select="StartingDocs" />
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
    
    <xsl:template name="numberOrWaitingIndidcator">
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