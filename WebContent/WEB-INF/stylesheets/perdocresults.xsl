<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
	<xsl:output method="html" omit-xml-declaration="yes" />
	<xsl:param name="urlparamwithoutstart" select="'#'"/>
	<xsl:param name="urlparamwithoutsort" select="'#'"/>
	<xsl:param name="urlparamwithoutvieworgroup" select="'#'"/>
	<xsl:param name="urlparamquery" select="'#'"/>
    <xsl:param name="query" select="'#'"/>
	
	<xsl:param name="title_name" select="'#'"/>
	<xsl:param name="author_name" select="'#'"/>
	<xsl:param name="date_name" select="'#'"/>
	<xsl:param name="source_name" select="'#'"/>
	
	<xsl:param name="webserviceurl" select="'#'"/>
    <xsl:param name="backendRequestUrl" select="'#'"/>
	<xsl:param name="resultkey" select="'#'"/>
	
	<xsl:template match="error">
		<h1>Error</h1>
        <xsl:value-of select="message" />
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
    
	<xsl:template match="docs">
		<xsl:variable name="totalHits" select="../summary/number-of-docs" />
		<xsl:variable name="numberOfPages" select="ceiling($totalHits div ../summary/window-size)" />
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
							<th class="tbl_hits"><a><xsl:attribute name="href"><xsl:value-of select="$urlparamwithoutsort" /><xsl:value-of select="'sortBy=size'" /></xsl:attribute>Hits</a></th>
						</tr>
					</thead>
					<tbody>		
					<xsl:for-each select="doc">						
						<tr>
							<td>
								<a target="_blank"><xsl:attribute name="href"><xsl:value-of select="'article?doc='" /><xsl:value-of select="doc-pid" /><xsl:value-of select="'&amp;query='" /><xsl:value-of select="$urlparamquery" /></xsl:attribute><xsl:value-of select="doc-info/*[name()=$title_name]" /> by <xsl:value-of select="doc-info/*[name()=$author_name]" /></a><br/>
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
					</tbody>
				</table>
			</div>
			<xsl:call-template name="pagination" />
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
	
	<xsl:template name="pagination">
		<div class="pagination">
		<xsl:variable name="resultsPerPage" select="../summary/window-size" />
		<xsl:variable name="totalHits" select="../summary/number-of-docs" />
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