import React, {useEffect, useState} from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  Image,
  Alert,
  PermissionsAndroid,
  Platform,
  Dimensions,
  View,
  TouchableOpacity,
  NativeModules,
  AppRegistry,
  StatusBar,
} from 'react-native';
import RNHTMLtoPDF from 'react-native-html-to-pdf';
import RNPrint from 'react-native-print';
import Pdf from 'react-native-pdf';
import {
  ImageLibraryOptions,
  ImagePickerResponse as OriginalImage,
  launchImageLibrary,
} from 'react-native-image-picker';
import NavigationBar from 'react-native-navbar';
import RNFetchBlob from 'rn-fetch-blob';
import Dialog from 'react-native-dialog';
import Icon from 'react-native-vector-icons/Ionicons';
import {name as appName} from './app.json';
import {montezFontDataUri} from './Montez';

type ActionExtensionCloseHandler = () => void;
type ActionExtensionPayload = {type: string; value: string};
type ActionExtensionPayloadGetter = () => Promise<ActionExtensionPayload>;
type ActionExtension = {
  done: ActionExtensionCloseHandler;
  getData: ActionExtensionPayloadGetter;
} | null;

type Size = {width: number; height: number};

const getSizeAsync = (uri: string): Promise<Size> =>
  new Promise((resolve, _) =>
    Image.getSize(uri, (width, height) => resolve({width, height})),
  );

const launchImageLibraryAsync = (
  options: ImageLibraryOptions,
): Promise<OriginalImage> =>
  new Promise((resolve, _) => launchImageLibrary(options, resolve));

const loadImage = async (
  uri: string,
  setOriginalImage: (image: OriginalImage) => void,
): Promise<void> => {
  try {
    const response = await RNFetchBlob.fetch('GET', uri);
    const fileName = uri.substring(uri.lastIndexOf('/'));
    const base64 = response.base64();
    const {width, height} = await getSizeAsync(uri);

    const image: OriginalImage = {
      didCancel: false,
      fileName,
      width,
      height,
      uri,
      base64,
    };
    RNFetchBlob.fs.unlink(uri);
    setOriginalImage(image);
  } catch (error) {
    console.error('Failed to load image from URI: ' + error);
    return Alert.alert(
      'Unable to load image',
      'Check the console for full the error message',
    );
  }
};

declare const global: {HermesInternal: null | {}};
const a4 = 21.0 / 29.7;
const doPrint = true;
const showOriginalImage = false;
const showPdf = true;

const hasAndroidPermission = async () => {
  const permission = PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE;

  const hasPermission = await PermissionsAndroid.check(permission);
  if (hasPermission) {
    return true;
  }

  const status = await PermissionsAndroid.request(permission);
  return status === 'granted';
};

const convertImageToPDF = async (
  image: OriginalImage,
  grayscaleEnabled: boolean,
  setPdfFilePath: (filePath: string) => void,
) => {
  console.log(`PDF image: ${image.uri}`);
  const rotated = image.width! > image.height!;
  const filter = grayscaleEnabled ? 'grayscale(1)' : 'none';

  const html = `
    <div style="height: 100%">
      <img src="data:image/jpeg;base64,${image.base64}" style="object-fit: contain; max-width: 100%; height: 100%; margin: 0 auto; filter: ${filter};">
    </div>
  `;

  const fileName = `${image.fileName!}-${grayscaleEnabled}`;

  await convertHTMLtoPDF(setPdfFilePath, html, fileName, rotated);
};

const hashCode = (s: string) => {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    let chr = s.charCodeAt(i);
    // eslint-disable-next-line no-bitwise
    hash = (hash << 5) - hash + chr;
    // eslint-disable-next-line no-bitwise
    hash |= 0;
  }
  return hash;
};

const fitTextToPDF = async (
  text: string,
  cursive: boolean,
  setPdfFilePath: (filePath: string | undefined) => void,
) => {
  let currentFontSize = 0;
  let lowerFontSize = 1;
  let upperFontSize = 256;
  let bestFontSize: number | undefined;
  let bestPdfFilePath: string | undefined;
  let lastPdfFilePath: string | undefined;

  // Safe exit in case the algorithm goes wild.
  let iterationLeft = 20;

  while (lowerFontSize < upperFontSize) {
    if (iterationLeft-- === 0) {
      break;
    }

    currentFontSize = Math.floor((lowerFontSize + upperFontSize) / 2);

    const success = await convertTextToPDF(
      text,
      cursive,
      currentFontSize,
      (filePath: string) => (lastPdfFilePath = filePath),
    );

    if (success && currentFontSize > (bestFontSize || 0)) {
      bestFontSize = currentFontSize;
      bestPdfFilePath = lastPdfFilePath;

      lowerFontSize = currentFontSize;
    } else {
      upperFontSize = currentFontSize - 1;
    }
  }

  setPdfFilePath(bestPdfFilePath);
};

const convertTextToPDF = (
  text: string,
  cursive: boolean,
  fontSize: number,
  setPdfFilePath: (filePath: string) => void,
) => {
  console.log(`PDF text: ${text}`);

  const fontFamily = cursive ? 'Montez' : 'sans-serif';

  const html = `
    <style>
    @font-face {
      font-family: "Montez";
      src: url("${montezFontDataUri}") format("truetype");
      font-weight: 400;
      font-style: normal;
    }
    </style>
    <style> p { white-space: pre-line; } </style>
    <div style="height: 100%; width: 100%">
      <p style="font-size: ${fontSize}px; font-family: '${fontFamily}';">${text}</div>
    </div>
  `;

  const fileNameId = hashCode(`${text}-${fontSize}-${Number(cursive)}`);

  return convertHTMLtoPDF(setPdfFilePath, html, `text-${fileNameId}`);
};

const convertHTMLtoPDF = async (
  setPdfFilePath: (filePath: string) => void,
  html: string,
  fileName: string,
  rotated?: boolean,
): Promise<boolean> => {
  try {
    const pdfHeight = 792;
    const pdfWidth = 612;

    // Missing property in type declarations.
    type PdfResult = RNHTMLtoPDF.Pdf & {numberOfPages: string};

    const results = (await RNHTMLtoPDF.convert({
      html,
      fileName,
      bgColor: '#ffffff',
      width: rotated ? pdfHeight : pdfWidth,
      height: rotated ? pdfWidth : pdfHeight,
    })) as PdfResult;

    let filePath = results.filePath;

    if (!filePath) {
      throw new Error('Empty filePath');
    }

    console.log(`PDF built: ${filePath}`);

    setPdfFilePath(filePath);
    return results.numberOfPages === '1';
  } catch (error) {
    console.error('Failed to convert to PDF');
    Alert.alert(
      'Unable to convert to PDF',
      'Check the console for full the error message',
    );
    return false;
  }
};

const printPDF = async (filePath: string) => {
  try {
    if (doPrint) {
      await RNPrint.print({filePath});
    }
  } catch (error) {
    console.error(error);
    return Alert.alert(
      'Unable to print',
      'Check the console for full the error message',
    );
  }
};

const getPhoto = async (
  setOriginalPhoto: (photo: OriginalImage | undefined) => void,
  setLoading: (value: boolean) => void,
) => {
  setLoading(true);
  setOriginalPhoto(undefined);
  let isAllowedToAccessPhotosOnAndroid = false;
  if (Platform.OS === 'android') {
    isAllowedToAccessPhotosOnAndroid = await hasAndroidPermission();
  }
  if (Platform.OS === 'ios' || isAllowedToAccessPhotosOnAndroid) {
    try {
      const image = await launchImageLibraryAsync({
        mediaType: 'photo',
        includeBase64: true,
      });
      if (image.didCancel || image.errorCode) {
        return setLoading(false);
      }
      setOriginalPhoto(image);
    } catch (error) {
      console.error(error);
      setLoading(false);
      return Alert.alert(
        'Unable to load camera roll',
        'Check that you authorized the access to the camera roll photos',
      );
    }
  }
};

const getDataFromExtension = async (
  getData: ActionExtensionPayloadGetter,
  setOriginalImage: (image: OriginalImage) => void,
) => {
  try {
    const {type, value} = await getData();
    if (type !== 'IMAGE') {
      throw new Error(`Unsupported format: ${type}`);
    }
    await loadImage(value, setOriginalImage);
  } catch (error) {
    console.error(error);
    return Alert.alert(
      'Unable to load image',
      'Check that you authorized the access to the camera roll photos',
    );
  }
};

const getPdfViewportSize = (image?: OriginalImage): Size => {
  const pdfWidth = Dimensions.get('screen').width * 0.95;
  const rotated = image && image.width! > image.height!;

  return {
    width: pdfWidth,
    height: rotated ? pdfWidth * a4 : pdfWidth / a4,
  };
};

const App = () => {
  const actionExtension: ActionExtension = NativeModules.ActionExtension;
  const {done, getData} = actionExtension ?? {
    done: null,
    getData: null,
  };

  const [originalImage, setOriginalImage] = useState<
    OriginalImage | undefined
  >();
  const [pdfFilePath, setPdfFilePath] = useState<string | undefined>();
  const [textPromptVisible, setTextPromptVisible] = useState<boolean>(false);
  const [textCursive, setTextCursive] = useState<boolean>(false);
  const [promptText, setPromptText] = useState<string | undefined>(undefined);
  const [text, setText] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(false);
  const [grayscaleEnabled, setGrayscaledEnabled] = useState<boolean>(false);

  const closeTextPrompt = (inputText: string | undefined) => {
    clearEverything();
    setText(inputText);
  };

  const clearEverything = () => {
    setLoading(false);
    setOriginalImage(undefined);
    setPdfFilePath(undefined);
    setTextPromptVisible(false);
    setPromptText(undefined);
    setText(undefined);
  };

  useEffect(() => {
    if (getData) {
      getDataFromExtension(getData, setOriginalImage);
    }
  }, [getData]);

  useEffect(() => {
    if (originalImage) {
      convertImageToPDF(originalImage, grayscaleEnabled, setPdfFilePath);
    }
  }, [originalImage, grayscaleEnabled, setPdfFilePath]);

  useEffect(() => {
    if (text && !textPromptVisible) {
      fitTextToPDF(text, textCursive, setPdfFilePath);
    }
  }, [text, textCursive, textPromptVisible, setPdfFilePath]);

  const {width, height} = getPdfViewportSize(originalImage);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent={false} />
      <SafeAreaView style={styles.container}>
        <NavigationBar
          title={{title: 'Resize for Print'}}
          leftButton={
            done || pdfFilePath ? (
              <TouchableOpacity
                onPress={() => (done ? done() : clearEverything())}
                style={styles.navBarButton}>
                <Text style={styles.buttonText}>Close</Text>
              </TouchableOpacity>
            ) : undefined
          }
          rightButton={
            <TouchableOpacity
              onPress={() => pdfFilePath && printPDF(pdfFilePath)}
              style={styles.navBarButton}
              disabled={!pdfFilePath}>
              <Icon
                name="print-outline"
                style={[
                  styles.buttonText,
                  styles.buttonIcon,
                  !pdfFilePath ? styles.disabled : null,
                ]}
              />
              <Text
                style={[
                  styles.buttonText,
                  !pdfFilePath ? styles.disabled : null,
                ]}>
                Print
              </Text>
            </TouchableOpacity>
          }
          style={styles.navigationBar}
          statusBar={{
            hidden: true,
          }}
        />
        {!pdfFilePath && (
          <View style={styles.hintContainer}>
            {loading ? (
              <Text style={styles.buttonText}>Loading...</Text>
            ) : (
              <>
                <TouchableOpacity
                  onPress={() => getPhoto(setOriginalImage, setLoading)}
                  style={styles.hint}>
                  <Icon
                    name="image-outline"
                    style={[styles.buttonText, styles.buttonIcon]}
                  />
                  <Text style={styles.buttonText}>Tap to select an image</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setTextPromptVisible(true)}
                  style={styles.hint}>
                  <Icon
                    name="document-text-outline"
                    style={[styles.buttonText, styles.buttonIcon]}
                  />
                  <Text style={styles.buttonText}>Tap to enter text</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
        {showOriginalImage && originalImage ? (
          <>
            <Text style={styles.instructions}>Original image</Text>
            <Image
              style={styles.image}
              width={250}
              height={250}
              source={{uri: originalImage.uri}}
              resizeMode="contain"
            />
          </>
        ) : null}
        <Dialog.Container
          visible={textPromptVisible}
          statusBarTranslucent
          contentStyle={styles.dialogContentStyle}>
          <Dialog.Title>Text</Dialog.Title>
          <Dialog.Input
            placeholder="Text"
            multiline={true}
            autoCapitalize="none"
            autoCompleteType="off"
            autoCorrect={false}
            autoFocus={true}
            numberOfLines={16}
            textAlignVertical="bottom"
            onChangeText={setPromptText}
            value={promptText}
            wrapperStyle={styles.textInputPrompt}
          />
          <Dialog.Switch
            label="Cursive"
            value={textCursive}
            onValueChange={(value: boolean) => setTextCursive(value)}
          />
          <Dialog.Button
            label="Cancel"
            onPress={() => closeTextPrompt(undefined)}
          />
          <Dialog.Button
            label="Confirm"
            disabled={!promptText}
            style={!promptText ? styles.disabled : null}
            onPress={() => closeTextPrompt(promptText)}
          />
        </Dialog.Container>

        {showPdf && pdfFilePath && (
          <View style={styles.pdfContainer}>
            <Pdf
              source={{uri: pdfFilePath}}
              fitPolicy={0}
              onError={(error) => console.error(error)}
              style={{
                width,
                height,
              }}
            />
            <Dialog.Switch
              value={grayscaleEnabled}
              label="Grayscale"
              onValueChange={(value: boolean) => setGrayscaledEnabled(value)}
              style={styles.toggle}
            />
          </View>
        )}
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  navigationBar: {
    backgroundColor: '#eee',
  },
  container: {
    flex: 1,
    backgroundColor: '#eee',
  },
  navBarButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 16,
    marginRight: 16,
  },
  buttonText: {
    color: '#0076FF',
    fontSize: 17,
    letterSpacing: 0.5,
  },
  buttonIcon: {
    marginRight: 4,
  },
  hintContainer: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hint: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  instructions: {
    textAlign: 'center',
    color: '#333333',
    marginBottom: 5,
  },
  image: {
    backgroundColor: 'grey',
  },
  textInputPrompt: {
    height: 248,
  },
  dialogContentStyle: {
    marginBottom: 128,
  },
  pdfContainer: {
    flex: 1,
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
  toggle: {
    marginTop: 4,
  },
});

AppRegistry.registerComponent(appName, () => App);

export default App;
