<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class SBS_Importer_Theme {
	private const OPTION_CSS  = 'sbs_imported_theme_css';
	private const OPTION_DATA = 'sbs_imported_theme_data';

	public static function register_hooks(): void {
		add_action( 'enqueue_block_assets', array( __CLASS__, 'enqueue' ), 20 );
	}

	public static function save( array $theme ): array {
		$css = self::build_css( $theme );
		update_option( self::OPTION_DATA, $theme, false );
		update_option( self::OPTION_CSS, $css, false );
		return array( 'css_bytes' => strlen( $css ), 'variables' => substr_count( $css, '--dst--' ) );
	}

	public static function enqueue(): void {
		$css = (string) get_option( self::OPTION_CSS, '' );
		if ( '' === $css ) {
			return;
		}
		wp_register_style( 'sbs-imported-theme', false, array(), SBS_IMPORTER_VERSION );
		wp_enqueue_style( 'sbs-imported-theme' );
		wp_add_inline_style( 'sbs-imported-theme', $css );
	}

	public static function build_css( array $theme ): string {
		$vars = array();
		foreach ( (array) ( $theme['colors'] ?? array() ) as $key => $value ) {
			self::add_var( $vars, '--dst--' . sanitize_key( (string) $key ), self::reference_or_value( $value, $theme['colors'] ?? array() ) );
		}
		foreach ( (array) ( $theme['layout'] ?? array() ) as $key => $value ) {
			self::add_var( $vars, '--dst--' . sanitize_key( (string) $key ), $value );
		}

		$fonts = $theme['typography']['fonts'] ?? array();
		foreach ( array( 'primary', 'secondary' ) as $role ) {
			if ( ! empty( $fonts[ $role ]['family'] ) ) {
				$fallback = $fonts[ $role ]['fallback'] ?? ( 'primary' === $role ? 'system-ui, sans-serif' : 'Georgia, serif' );
				self::add_var( $vars, '--dst--font-' . $role, "'" . str_replace( "'", '', (string) $fonts[ $role ]['family'] ) . "', " . $fallback );
			}
		}

		$headings = $theme['typography']['headings'] ?? array();
		foreach ( array( 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pretitle', 'subtitle', 'backtitle' ) as $role ) {
			if ( empty( $headings[ $role ] ) || ! is_array( $headings[ $role ] ) ) {
				continue;
			}
			$h = $headings[ $role ];
			if ( isset( $h['min'], $h['max'] ) ) {
				$mid = in_array( $role, array( 'h1', 'h2', 'backtitle' ), true ) ? '6vw' : '3vw';
				self::add_var( $vars, '--dst--fs-' . $role, 'clamp(' . $h['min'] . ',' . $mid . ',' . $h['max'] . ')' );
			}
			$map = array( 'ff' => 'ff', 'fw' => 'fw', 'lh' => 'lh', 'ls' => 'ls', 'tt' => 'tt' );
			foreach ( $map as $source => $suffix ) {
				if ( array_key_exists( $source, $h ) ) {
					$value = $h[ $source ];
					if ( 'ff' === $source && in_array( $value, array( 'primary', 'secondary' ), true ) ) {
						$value = 'var(--dst--font-' . $value . ')';
					}
					self::add_var( $vars, '--dst--' . $role . '-' . $suffix, $value );
				}
			}
		}
		$body = $theme['typography']['body'] ?? array();
		if ( isset( $body['base']['lh'] ) ) {
			self::add_var( $vars, '--dst--base-lh', $body['base']['lh'] );
		}
		foreach ( (array) ( $body['scale'] ?? array() ) as $role => $scale ) {
			if ( is_array( $scale ) && isset( $scale['min'], $scale['max'] ) ) {
				self::add_var( $vars, '--dst--fs-' . sanitize_key( (string) $role ), 'clamp(' . $scale['min'] . ',1.2vw,' . $scale['max'] . ')' );
			}
		}

		$buttons = $theme['elements']['buttons'] ?? array();
		$shared = $buttons['shared'] ?? array();
		$shared_map = array( 'ff' => 'ff', 'fs' => 'fs', 'fw' => 'fw', 'tt' => 'tt', 'ls' => 'ls', 'radius' => 'br', 'padding' => 'p', 'gap' => 'gap', 'iconSize' => 'icon-size' );
		foreach ( $shared_map as $source => $suffix ) {
			if ( isset( $shared[ $source ] ) ) {
				$value = $shared[ $source ];
				if ( 'ff' === $source && in_array( $value, array( 'primary', 'secondary' ), true ) ) {
					$value = 'var(--dst--font-' . $value . ')';
				}
				self::add_var( $vars, '--dst--btn-' . $suffix, $value );
			}
		}
		$button_roles = array( 'primary' => 'primary', 'primaryInverted' => 'primary-inverted', 'secondary' => 'secondary', 'secondaryInverted' => 'secondary-inverted', 'link' => 'link' );
		$button_map = array( 'c' => 'c', 'bg' => 'bg', 'bdc' => 'bdc', 'bdw' => 'bdw', 'cHover' => 'c-hover', 'bgHover' => 'bg-hover', 'bdcHover' => 'bdc-hover' );
		foreach ( $button_roles as $source_role => $slug ) {
			foreach ( $button_map as $source => $suffix ) {
				if ( isset( $buttons[ $source_role ][ $source ] ) ) {
					self::add_var( $vars, '--dst--btn-' . $slug . '-' . $suffix, self::reference_or_value( $buttons[ $source_role ][ $source ], $theme['colors'] ?? array() ) );
				}
			}
		}

		if ( ! empty( $theme['motion']['duration'] ) ) {
			self::add_var( $vars, '--sbs-motion-duration', $theme['motion']['duration'] );
		}
		if ( ! empty( $theme['motion']['distance'] ) ) {
			self::add_var( $vars, '--sbs-motion-distance', $theme['motion']['distance'] );
		}

		// Mini SBS 2.2.2+ exports the exact resolved design-dial tokens used by
		// the browser preview. Consuming them here prevents WordPress from trying
		// to reconstruct spacing, type, imagery and motion from approximate dial
		// percentages. Unknown keys are deliberately ignored.
		$dial_map = array(
			'sectionGap' => '--dst--desktop-vertical-gap', 'sectionGapSmall' => '--dst--vgap-s', 'sectionGapLarge' => '--dst--vgap-l',
			'headerHeight' => '--dst--header-height', 'containerWidth' => '--dst--default-container-width', 'altContainerWidth' => '--dst--alt-container-width',
			'radius' => '--dst--default-radius', 'h1' => '--dst--fs-h1', 'h2' => '--dst--fs-h2', 'h3' => '--dst--fs-h3', 'h4' => '--dst--fs-h4',
			'cardPadding' => '--sbs-card-pad', 'cardBodyPadding' => '--sbs-card-body-pad', 'gridGap' => '--sbs-grid-gap', 'stackGap' => '--sbs-stack-gap',
			'bodyLineHeight' => '--sbs-body-lh', 'measure' => '--sbs-measure', 'typeScale' => '--sbs-type-scale', 'titleTracking' => '--sbs-title-tracking',
			'titleLineHeight' => '--sbs-title-lh', 'pretitleTracking' => '--sbs-pretitle-ls', 'accentStrength' => '--sbs-accent-strength', 'accentRule' => '--sbs-accent-rule',
			'accentTintAlpha' => '--sbs-accent-tint', 'borderAlpha' => '--sbs-border-alpha', 'borderWidth' => '--sbs-border-width', 'cardShadow' => '--sbs-card-shadow',
			'cardSurfaceMix' => '--sbs-card-surface-mix', 'mediaMinHeight' => '--sbs-media-min', 'mediaSaturate' => '--sbs-media-saturate', 'mediaContrast' => '--sbs-media-contrast',
			'heroMinHeight' => '--sbs-hero-min', 'heroMediaWidth' => '--sbs-hero-media-w', 'heroOverlayAlpha' => '--sbs-hero-overlay-a',
			'motionDuration' => '--sbs-motion-duration', 'motionDistance' => '--sbs-motion-distance', 'motionScale' => '--sbs-motion-scale', 'motionStagger' => '--sbs-motion-stagger',
			'motionEase' => '--sbs-motion-ease', 'hoverLift' => '--sbs-hover-lift', 'mediaHoverZoom' => '--sbs-media-zoom', 'marqueeDuration' => '--sbs-marquee-dur',
			'decorScale' => '--sbs-decor-scale', 'decorOpacity' => '--sbs-decor-opacity',
		);
		foreach ( (array) ( $theme['designDialTokens'] ?? array() ) as $key => $value ) {
			if ( isset( $dial_map[ $key ] ) ) self::add_var( $vars, $dial_map[ $key ], $value );
		}

		if ( ! $vars ) {
			return '';
		}
		$declarations = '';
		foreach ( $vars as $name => $value ) {
			$declarations .= $name . ':' . $value . ';';
		}
		$rules = "\n" .
			".wp-site-blocks,.wp-block-post-content,.editor-styles-wrapper{line-height:var(--sbs-body-lh,inherit)}\n" .
			".wp-site-blocks .sbs-rich-text,.wp-block-post-content .sbs-rich-text,.editor-styles-wrapper .sbs-rich-text{max-width:var(--sbs-measure,none)}\n" .
			".wp-site-blocks .c-heading__sub,.wp-site-blocks .c-heading__description p,.wp-block-post-content .c-heading__sub,.wp-block-post-content .c-heading__description p,.editor-styles-wrapper .c-heading__sub,.editor-styles-wrapper .c-heading__description p{max-width:var(--sbs-measure,none)}\n" .
			".wp-site-blocks .c-heading__title,.wp-block-post-content .c-heading__title,.editor-styles-wrapper .c-heading__title{letter-spacing:var(--sbs-title-tracking,inherit);line-height:var(--sbs-title-lh,inherit);text-wrap:balance}\n" .
			".wp-site-blocks .c-heading__pre,.wp-block-post-content .c-heading__pre,.editor-styles-wrapper .c-heading__pre{letter-spacing:var(--sbs-pretitle-ls,inherit)}\n" .
			".wp-site-blocks .c-block,.wp-block-post-content .c-block,.editor-styles-wrapper .c-block{box-shadow:var(--sbs-card-shadow,none);border-width:var(--sbs-border-width,0);transition-duration:var(--sbs-motion-duration,0s);transition-timing-function:var(--sbs-motion-ease,ease)}\n" .
			".wp-site-blocks .ph,.wp-site-blocks .c-block__media,.wp-block-post-content .ph,.wp-block-post-content .c-block__media,.editor-styles-wrapper .ph,.editor-styles-wrapper .c-block__media{border-radius:var(--dst--default-radius,0);overflow:hidden}\n" .
			".wp-site-blocks .ph img,.wp-site-blocks .c-bg__layer,.wp-block-post-content .ph img,.wp-block-post-content .c-bg__layer,.editor-styles-wrapper .ph img,.editor-styles-wrapper .c-bg__layer{filter:saturate(var(--sbs-media-saturate,1)) contrast(var(--sbs-media-contrast,1));transition:transform var(--sbs-motion-duration,0s) var(--sbs-motion-ease,ease)}\n" .
			"@media(prefers-reduced-motion:reduce){.wp-site-blocks,.wp-block-post-content,.editor-styles-wrapper{--sbs-motion-duration:0s;--sbs-motion-distance:0px;--sbs-motion-scale:1;--sbs-motion-stagger:0ms;--sbs-hover-lift:0px;--sbs-media-zoom:1}}";
		return ":root{" . $declarations . "}\n.wp-site-blocks{" . $declarations . "}\n.wp-block-post-content{" . $declarations . "}\n.editor-styles-wrapper{" . $declarations . "}\n" . $rules . "\n";
	}

	private static function reference_or_value( $value, array $colors ) {
		if ( is_string( $value ) && array_key_exists( $value, $colors ) ) {
			return 'var(--dst--' . sanitize_key( $value ) . ')';
		}
		return $value;
	}

	private static function add_var( array &$vars, string $name, $value ): void {
		if ( is_array( $value ) || is_object( $value ) || null === $value ) {
			return;
		}
		$value = trim( (string) $value );
		if ( '' === $value || ! self::safe_css_value( $value ) ) {
			return;
		}
		$vars[ $name ] = $value;
	}

	private static function safe_css_value( string $value ): bool {
		if ( strlen( $value ) > 300 || preg_match( '/[{};<>]|@import|expression\s*\(|javascript:|url\s*\(/i', $value ) ) {
			return false;
		}
		return (bool) preg_match( '/^[#(),.%\-+\/\s\w\'\"]+$/u', $value );
	}
}
