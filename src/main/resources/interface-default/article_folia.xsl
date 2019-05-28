<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xpath-default-namespace="http://ilk.uvt.nl/folia">
	<xsl:output encoding="utf-8" method="html" omit-xml-declaration="yes" />

	<xsl:template match="//*[local-name()='error']">
		<h1>Error</h1>
		<xsl:value-of select="//*[local-name()='message']" />
		(Error code: <xsl:value-of select="//*[local-name()='code']" />)
	</xsl:template>

	<xsl:template match="//*[local-name()='metadata']" />

	<xsl:template match="//*[local-name()='head']">
		<b>
			<xsl:apply-templates />
		</b>
	</xsl:template>

	<xsl:template match="//*[local-name()='p']">
		<p>
			<xsl:apply-templates />
		</p>
	</xsl:template>

	<!-- We show w/t explicitly. Don't also show t elements for paragraphs or sentences -->
	<xsl:template match="//*[local-name()='p' or local-name()='s']/*[local-name()='t']"/>

	<xsl:template match="//*[local-name()='w']">
		<xsl:variable name="lemma" select="./*[local-name()='lemma' and @class]/@class[0]"/>
		<span class="word" data-toggle="tooltip">
			<xsl:attribute name="data-lemma">
				<xsl:value-of select="$lemma" />
			</xsl:attribute>
			<xsl:value-of select="./*[local-name()='t']" />
		</span>
		<xsl:text> </xsl:text>
	</xsl:template>

	<xsl:template match="//*[local-name()='hl']">
		<span class="hl">
			<xsl:apply-templates />
		</span>
	</xsl:template>
</xsl:stylesheet>