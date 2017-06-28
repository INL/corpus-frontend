<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:tei="http://www.tei-c.org/ns/1.0" exclude-result-prefixes="tei">
	<xsl:output encoding="utf-8" method="html" omit-xml-declaration="yes" />
	<xsl:param name="title_name" select="'#'"/>

	<xsl:template match="error">
		<h1>Error</h1>
        <xsl:value-of select="message" />
        (Error code: <xsl:value-of select="code" />)
	</xsl:template>
	
	<xsl:template match="docPid|docFields" />
	
	<xsl:template match="docInfo">
		<div class="col-xs-12 contentbox">
			<h2>
				<xsl:value-of select="*[name()=$title_name]" />
			</h2>
			
			<div class="row">
				<div class="col-xs-3 col-lg-2">
					<i>Hits in document:</i>
				</div>
				<div class="col-xs-9 col-lg-10" id="divHitsInDocument">
					<!-- will be filled in from article.js -->
				</div>

				<xsl:for-each select="child::*[name()!='mayView']">
					<div class="col-xs-3 col-lg-2">
						<i>
						<!-- <xsl:value-of select="local-name()" /> -->
						<xsl:call-template name="elementFriendlyName" />:
						</i>
					</div>
					<div class="col-xs-9 col-lg-10">
						<xsl:value-of select="." />
						<xsl:if test="../mayView/text() = 'true' and local-name() = 'lengthInTokens' and number(text()) > 5000">
						(first 5000 tokens shown)
						</xsl:if>
					</div>
					<div class="clearfix"></div>
				</xsl:for-each> 
			</div>
		</div>
	</xsl:template>

	<xsl:variable name="vLower" select="'abcdefghijklmnopqrstuvwxyz'"/>

 	<xsl:variable name="vUpper" select="'ABCDEFGHIJKLMNOPQRSTUVWXYZ'"/>
 
	<xsl:template name = "elementFriendlyName" >
		<xsl:choose>
			<xsl:when test="local-name() = 'lengthInTokens'">Document length (tokens)</xsl:when>
			<xsl:when test="local-name() = 'fromInputFile'">From input file</xsl:when>
			<xsl:when test="local-name() = 'yearFrom'">Year (from)</xsl:when>
			<xsl:when test="local-name() = 'yearTo'">Year (to)</xsl:when>
			<xsl:otherwise><xsl:value-of select="concat(translate(substring(local-name(), 1, 1), $vLower, $vUpper), substring(local-name(), 2))" /></xsl:otherwise>
		</xsl:choose>
	</xsl:template>
	
</xsl:stylesheet>
