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
		<div class="span12 contentbox">
			<h2>
				<xsl:value-of select="*[name()=$title_name]" />
			</h2>
			<div class="span10">
				<div class="span2">
					<i>Hits in document:</i>
				</div>
				<div class="span7" id="divHitsInDocument">
					<!-- will be filled in from article.js -->
				</div>
			</div>
			<xsl:for-each select="child::*[name()!='mayView']">
				<div class="span10">
					<div class="span2">
						<i><xsl:value-of select="local-name()" />:</i>
					</div>
					<div class="span7">
						<xsl:value-of select="."/>
					</div>
				</div>
			</xsl:for-each> 
		</div>
	</xsl:template>
	
</xsl:stylesheet>
