<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
	<xsl:output encoding="utf-8" method="html" omit-xml-declaration="yes" />

	<xsl:template match="error">
		<h1>Error</h1>
		<xsl:value-of select="message" />
		(Error code:
		<xsl:value-of select="code" />
		)
	</xsl:template>

	<xsl:template match="/" >
		<xsl:apply-templates select="/blacklabResponse/docInfo"/>
	</xsl:template>

	<xsl:template match="docInfo">
		<h2 style="word-break:break-all;">
			<xsl:value-of select="*[name()=/*//titleField]" />
		</h2>

		<table class="table-striped">
			<tbody>
				<!-- will be filled in from article.js -->
				<tr><td>Hits in document:</td><td><div id="divHitsInDocument"></div></td></tr>

				<xsl:choose>
					<xsl:when test="metadataFieldGroups/metadataFieldGroup">
						<xsl:for-each select="metadataFieldGroups/metadataFieldGroup">
							<tr><td colspan="2"><b><xsl:value-of select="name"/>:</b></td></tr>
							<xsl:for-each select="fields/field">
								<tr><td style="padding-left: 0.5em"><xsl:value-of select="/blacklabResponse/metadataFieldDisplayNames/*[name()=current()]" /></td><td><xsl:value-of select="//docInfo/*[name()=current()]" /></td></tr>
							</xsl:for-each>
						</xsl:for-each>
					</xsl:when>
					<xsl:otherwise>
						<xsl:for-each select="*[name()!='mayView' and name() != 'lengthInTokens']">
							<tr><td><xsl:value-of select="/blacklabResponse/metadataFieldDisplayNames/*[name()=current()]" /></td><td><xsl:value-of select="." /></td></tr>
						</xsl:for-each>
					</xsl:otherwise>
				</xsl:choose>
				<tr><td>Document length (tokens)</td><td><xsl:value-of select="lengthInTokens"/></td></tr>
			</tbody>
		</table>
	</xsl:template>

</xsl:stylesheet>
